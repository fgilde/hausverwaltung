import { prisma } from "@/lib/prisma";
import { roleAllows, WRITE_ROLES } from "@/lib/rbac";
import type { ApiPrincipal } from "@/lib/api-auth";
import { ApiWriteError } from "@/lib/api-write";
import { sendMail, type MailAttachment } from "@/lib/adapters/mailer";
import { readFile, saveFile } from "@/lib/storage";
import { parseCamt053 } from "@/lib/adapters/bankImport";
import { isEInvoice, parseEInvoice } from "@/lib/adapters/erechnung";

// Dedizierte Operationen (kein reines CRUD) für REST-API + MCP.
// Fachlogik gespiegelt aus den Server Actions, aber Bearer-Auth statt Session.

type Args = Record<string, unknown>;
type Op = {
  description: string;
  params: Record<string, string>; // Name → Kurzbeschreibung (für Discovery/MCP)
  required?: string[];
  adminOnly?: boolean;
  run: (p: ApiPrincipal, a: Args) => Promise<unknown>;
};

const DUNNING_FEE: Record<number, number> = { 1: 0, 2: 5, 3: 10 };
const s = (v: unknown) => (v == null ? undefined : String(v));
const need = (a: Args, k: string) => {
  const v = a[k];
  if (v == null || v === "") throw new ApiWriteError(`${k} erforderlich`, 400);
  return v;
};

/**
 * Flächenmodell-Miete: je aktiver (nicht-outdoor) Teilfläche mit m²-Preis eine
 * Monats-Sollstellung (Fläche·Preis). Dedup über @@unique(areaAllocationId, period).
 * Gibt Anzahl neu erzeugter Sollstellungen zurück.
 */
export async function generateAreaCharges(tenantId: string, first: Date, due: Date, last: Date): Promise<number> {
  const props = await prisma.property.findMany({
    where: { tenantId, areaModel: true },
    select: {
      areaAllocations: {
        where: { outdoor: false, pricePerSqm: { not: null }, from: { lte: last }, OR: [{ to: null }, { to: { gte: first } }] },
        select: { id: true, leaseId: true, label: true, area: true, pricePerSqm: true },
      },
    },
  });
  let created = 0;
  for (const p of props) {
    for (const a of p.areaAllocations) {
      const amount = Number(a.area) * Number(a.pricePerSqm);
      if (amount <= 0) continue;
      try {
        await prisma.charge.create({
          data: {
            tenantId,
            areaAllocationId: a.id,
            leaseId: a.leaseId ?? null,
            type: "MIETE",
            period: first,
            dueDate: due,
            amount: Math.round(amount * 100) / 100,
            description: a.label ?? "Flächenmiete",
          },
        });
        created++;
      } catch {
        // Unique-Verletzung → für diese Teilfläche/Periode existiert bereits eine Sollstellung
      }
    }
  }
  return created;
}

async function smtpConfig(tenantId: string) {
  const t = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { smtpHost: true, smtpPort: true, smtpUser: true, smtpPassword: true, smtpFrom: true, smtpSecure: true },
  });
  return { host: t?.smtpHost, port: t?.smtpPort, user: t?.smtpUser, password: t?.smtpPassword, from: t?.smtpFrom, secure: t?.smtpSecure };
}
const addrList = (v: unknown) => String(v ?? "").split(/[,;]/).map((x) => x.trim()).filter(Boolean);

export const OPERATIONS: Record<string, Op> = {
  run_charge_generation: {
    description: "Sollstellungslauf: erzeugt für alle aktiven Mietverträge die Miet-Sollstellung des Monats (Dedup: bereits vorhandene bleiben). month = YYYY-MM.",
    params: { month: "Abrechnungsmonat YYYY-MM" },
    required: ["month"],
    run: async (p, a) => {
      const month = String(need(a, "month"));
      if (!/^\d{4}-\d{2}$/.test(month)) throw new ApiWriteError("month muss YYYY-MM sein", 400);
      const [y, m] = month.split("-").map(Number);
      const first = new Date(Date.UTC(y, m - 1, 1));
      const last = new Date(Date.UTC(y, m, 0));
      const due = new Date(Date.UTC(y, m - 1, 3));
      const leases = await prisma.lease.findMany({
        where: { tenantId: p.tenantId, startDate: { lte: last }, OR: [{ endDate: null }, { endDate: { gte: first } }] },
        include: { components: { select: { amount: true } }, charges: { where: { period: first, type: "MIETE" }, select: { id: true } } },
      });
      let created = 0;
      for (const l of leases) {
        if (l.charges.length > 0) continue;
        const warm = Number(l.rentCold) + l.components.reduce((x, c) => x + Number(c.amount), 0);
        await prisma.charge.create({ data: { tenantId: p.tenantId, leaseId: l.id, type: "MIETE", period: first, dueDate: due, amount: warm } });
        created++;
      }
      created += await generateAreaCharges(p.tenantId, first, due, last);
      return { created, skipped: leases.length - created };
    },
  },

  run_dunning: {
    description: "Mahnlauf: für alle überfälligen, nicht voll bezahlten Sollstellungen die nächste Mahnstufe (max. 3) anlegen. Optional auf ein Objekt (propertyId) begrenzen.",
    params: { propertyId: "optional: nur dieses Objekt" },
    run: async (p, a) => {
      const propertyId = s(a.propertyId);
      const now = new Date();
      const charges = await prisma.charge.findMany({
        where: {
          tenantId: p.tenantId,
          dueDate: { lt: now },
          ...(propertyId ? { lease: { unit: { building: { propertyId } } } } : {}),
        },
        include: { payments: { select: { amount: true } }, dunnings: { select: { level: true } } },
      });
      let dunned = 0;
      for (const c of charges) {
        const open = Number(c.amount) - c.payments.reduce((x, pay) => x + Number(pay.amount), 0);
        if (open <= 0.005) continue;
        const level = c.dunnings.length + 1;
        if (level > 3) continue;
        await prisma.dunningNotice.create({ data: { tenantId: p.tenantId, chargeId: c.id, level, fee: DUNNING_FEE[level] ?? 0 } });
        dunned++;
      }
      return { dunned };
    },
  },

  apply_adjustment: {
    description: "Mietanpassung (Staffel/Index) anwenden: setzt die Kaltmiete des Vertrags auf den neuen Wert und markiert die Anpassung als angewandt. id = RentAdjustment-ID.",
    params: { id: "RentAdjustment-ID" },
    required: ["id"],
    run: async (p, a) => {
      const id = String(need(a, "id"));
      const adj = await prisma.rentAdjustment.findFirst({ where: { id, tenantId: p.tenantId } });
      if (!adj) throw new ApiWriteError("Anpassung nicht gefunden", 404);
      await prisma.$transaction([
        prisma.lease.update({ where: { id: adj.leaseId }, data: { rentCold: adj.newRentCold } }),
        prisma.rentAdjustment.update({ where: { id: adj.id }, data: { applied: true } }),
      ]);
      return { id, applied: true, newRentCold: Number(adj.newRentCold) };
    },
  },

  advance_maintenance: {
    description: "Wartungsvertrag fortschreiben: nächste Fälligkeit um das Intervall verschieben. id = MaintenanceContract-ID.",
    params: { id: "MaintenanceContract-ID" },
    required: ["id"],
    run: async (p, a) => {
      const id = String(need(a, "id"));
      const mc = await prisma.maintenanceContract.findFirst({ where: { id, tenantId: p.tenantId } });
      if (!mc) throw new ApiWriteError("Wartungsvertrag nicht gefunden", 404);
      const next = new Date(mc.nextDue);
      next.setMonth(next.getMonth() + mc.intervalMonths);
      await prisma.maintenanceContract.update({ where: { id: mc.id }, data: { nextDue: next } });
      return { id, nextDue: next.toISOString().slice(0, 10) };
    },
  },

  add_ticket_time: {
    description: "Zeiterfassung: Minuten auf ein Ticket buchen (addiert). id = Ticket-ID, minutes > 0.",
    params: { id: "Ticket-ID", minutes: "Minuten (>0)" },
    required: ["id", "minutes"],
    run: async (p, a) => {
      const id = String(need(a, "id"));
      const minutes = Math.trunc(Number(need(a, "minutes")));
      if (!(minutes > 0)) throw new ApiWriteError("minutes muss > 0 sein", 400);
      const res = await prisma.ticket.updateMany({ where: { id, tenantId: p.tenantId }, data: { timeSpentMin: { increment: minutes } } });
      if (res.count === 0) throw new ApiWriteError("Ticket nicht gefunden", 404);
      return { id, added: minutes };
    },
  },

  toggle_task: {
    description: "Aufgabe erledigt/offen umschalten. id = Task-ID.",
    params: { id: "Task-ID" },
    required: ["id"],
    run: async (p, a) => {
      const id = String(need(a, "id"));
      const task = await prisma.task.findFirst({ where: { id, tenantId: p.tenantId } });
      if (!task) throw new ApiWriteError("Aufgabe nicht gefunden", 404);
      await prisma.task.update({ where: { id: task.id }, data: { done: !task.done } });
      return { id, done: !task.done };
    },
  },

  import_camt: {
    description: "Bank-Import camt.053: XML-Kontoauszug einlesen, Buchungen anlegen und Eingänge automatisch offenen Sollstellungen zuordnen. xml = Dateiinhalt, accountId optional.",
    params: { xml: "camt.053 XML-Inhalt", accountId: "optional: Zielkonto-ID" },
    required: ["xml"],
    run: async (p, a) => {
      const xml = String(need(a, "xml"));
      const accountId = s(a.accountId) ?? null;
      if (accountId) {
        const acc = await prisma.account.findFirst({ where: { id: accountId, tenantId: p.tenantId }, select: { id: true } });
        if (!acc) throw new ApiWriteError("Konto nicht gefunden", 400);
      }
      let entries;
      try {
        entries = parseCamt053(xml);
      } catch {
        throw new ApiWriteError("camt.053 konnte nicht gelesen werden", 400);
      }
      if (entries.length === 0) throw new ApiWriteError("Keine Buchungen in der Datei", 400);
      const charges = await prisma.charge.findMany({ where: { tenantId: p.tenantId }, include: { payments: { select: { amount: true } } } });
      const openMap = charges.map((c) => ({ id: c.id, open: Number(c.amount) - c.payments.reduce((x, pay) => x + Number(pay.amount), 0) }));
      let matched = 0;
      for (const e of entries) {
        let chargeId: string | null = null;
        if (e.direction === "EINGANG") {
          const hit = openMap.find((o) => o.open > 0 && Math.abs(o.open - e.amount) < 0.005);
          if (hit) { chargeId = hit.id; hit.open = 0; matched++; }
        }
        await prisma.payment.create({ data: { tenantId: p.tenantId, accountId, chargeId, date: new Date(e.date), amount: e.amount, direction: e.direction, reference: e.reference } });
      }
      return { imported: entries.length, matched };
    },
  },

  send_email: {
    description: "E-Mail anlegen und sofort versenden (nutzt die SMTP-Konfiguration; ohne SMTP bleibt sie im Postausgang). toAddress kommagetrennt, documentIds optional als Anhänge aus der Ablage.",
    params: { toAddress: "Empfänger (kommagetrennt)", subject: "Betreff", body: "Text", cc: "optional", bcc: "optional", documentIds: "optional: Array von Dokument-IDs" },
    required: ["toAddress", "subject", "body"],
    run: async (p, a) => {
      const toAddress = String(need(a, "toAddress"));
      const subject = String(need(a, "subject"));
      const body = String(need(a, "body"));
      const docIds = Array.isArray(a.documentIds) ? (a.documentIds as unknown[]).map(String) : [];
      if (docIds.length) {
        const count = await prisma.document.count({ where: { id: { in: docIds }, tenantId: p.tenantId } });
        if (count !== docIds.length) throw new ApiWriteError("Dokument nicht gefunden", 400);
      }
      const msg = await prisma.emailMessage.create({
        data: {
          tenantId: p.tenantId, toAddress, cc: s(a.cc) ?? null, bcc: s(a.bcc) ?? null, subject, body,
          status: "ENTWURF", attachments: { create: docIds.map((documentId) => ({ documentId })) },
        },
        include: { attachments: { include: { document: true } } },
      });
      const cfg = await smtpConfig(p.tenantId);
      try {
        const attachments: MailAttachment[] = [];
        for (const at of msg.attachments) {
          try { attachments.push({ filename: at.document.name, content: await readFile(at.document.storageKey) }); } catch { /* fehlt */ }
        }
        await sendMail({ to: addrList(msg.toAddress), cc: addrList(msg.cc), bcc: addrList(msg.bcc), subject, body, attachments }, cfg);
        await prisma.emailMessage.update({ where: { id: msg.id }, data: { status: "GESENDET", sentAt: new Date(), error: null } });
        return { id: msg.id, status: "GESENDET" };
      } catch (e) {
        const error = e instanceof Error ? e.message : "Versand fehlgeschlagen";
        await prisma.emailMessage.update({ where: { id: msg.id }, data: { status: "FEHLER", error } });
        return { id: msg.id, status: "FEHLER", error };
      }
    },
  },

  upload_document: {
    description: "Dokument hochladen (Inhalt als Base64). Optional Verknüpfung zu Objekt/Einheit/Person. E-Rechnungen (XML) werden automatisch ausgelesen.",
    params: { name: "Dateiname", contentBase64: "Dateiinhalt Base64", mime: "MIME-Typ", category: "VERTRAG|RECHNUNG|ERECHNUNG|PROTOKOLL|ABRECHNUNG|SONSTIGES", propertyId: "optional", unitId: "optional", personId: "optional" },
    required: ["name", "contentBase64"],
    run: async (p, a) => {
      const name = String(need(a, "name"));
      const buffer = Buffer.from(String(need(a, "contentBase64")), "base64");
      if (buffer.length === 0) throw new ApiWriteError("Leerer Inhalt", 400);
      if (buffer.length > 20 * 1024 * 1024) throw new ApiWriteError("Datei zu groß (max. 20 MB)", 400);
      const mime = s(a.mime) ?? "application/octet-stream";
      const category = (s(a.category) ?? "SONSTIGES") as string;
      const rels: Array<["propertyId" | "unitId" | "personId", "property" | "unit" | "person"]> = [
        ["propertyId", "property"], ["unitId", "unit"], ["personId", "person"],
      ];
      const link: Record<string, string | null> = { propertyId: null, unitId: null, personId: null };
      for (const [field, model] of rels) {
        const id = s(a[field]);
        if (!id) continue;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const row = await (prisma as any)[model].findFirst({ where: { id, tenantId: p.tenantId }, select: { id: true } });
        if (!row) throw new ApiWriteError(`${field}: nicht gefunden`, 400);
        link[field] = id;
      }
      const storageKey = await saveFile(buffer, name);
      const eInvoice = isEInvoice(mime, name) || category === "ERECHNUNG";
      const parsed = eInvoice ? parseEInvoice(buffer, mime) : null;
      const doc = await prisma.document.create({
        data: {
          tenantId: p.tenantId, name, category: category as never, mime, size: buffer.length, storageKey, eInvoice,
          propertyId: link.propertyId, unitId: link.unitId, personId: link.personId,
          invoiceNo: parsed?.invoiceNumber ?? null, invoiceTotal: parsed?.total ?? null,
        },
      });
      return { id: doc.id, eInvoice, invoiceNo: doc.invoiceNo };
    },
  },

  update_ai_config: {
    description: "KI-Konfiguration des Mandanten setzen (nur Admin). provider anthropic|openai, baseUrl/model optional, apiKey nur senden zum Ändern.",
    params: { provider: "anthropic|openai", baseUrl: "optional", model: "optional", apiKey: "optional (nur zum Ändern)" },
    adminOnly: true,
    run: async (p, a) => {
      await prisma.tenant.update({
        where: { id: p.tenantId },
        data: { aiProvider: s(a.provider) ?? null, aiBaseUrl: s(a.baseUrl) ?? null, aiModel: s(a.model) ?? null, ...(s(a.apiKey) ? { aiApiKey: s(a.apiKey) } : {}) },
      });
      return { ok: true };
    },
  },

  update_smtp_config: {
    description: "SMTP-Konfiguration des Mandanten setzen (nur Admin). password nur senden zum Ändern.",
    params: { host: "SMTP-Host", port: "Port", user: "Benutzer", from: "Absender", secure: "true|false", password: "optional (nur zum Ändern)" },
    adminOnly: true,
    run: async (p, a) => {
      await prisma.tenant.update({
        where: { id: p.tenantId },
        data: {
          smtpHost: s(a.host) ?? null, smtpPort: a.port != null ? Number(a.port) : null, smtpUser: s(a.user) ?? null,
          smtpFrom: s(a.from) ?? null, smtpSecure: String(a.secure) === "true", ...(s(a.password) ? { smtpPassword: s(a.password) } : {}),
        },
      });
      return { ok: true };
    },
  },
};

export const OPERATION_NAMES = Object.keys(OPERATIONS);

export function listOperations() {
  return OPERATION_NAMES.map((name) => {
    const op = OPERATIONS[name];
    return { name, description: op.description, params: op.params, required: op.required ?? [], adminOnly: !!op.adminOnly };
  });
}

export async function runOperation(p: ApiPrincipal, name: string, args: Args) {
  const op = OPERATIONS[name];
  if (!op) throw new ApiWriteError(`Unbekannte Operation: ${name}`, 404);
  if (!roleAllows(p.role, WRITE_ROLES)) throw new ApiWriteError("Keine Schreibberechtigung", 403);
  if (op.adminOnly && p.role !== "ADMIN") throw new ApiWriteError("Nur Administratoren", 403);
  return op.run(p, args ?? {});
}
