import "server-only";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { readFile } from "@/lib/storage";
import { pingenSend, pingenStatus, mapPingenStatus, type PingenConfig, type PingenOptions } from "@/lib/adapters/pingen";
import { epostSend, epostStatus, mapEpostStatus, splitAddress, type EpostConfig, type EpostOptions } from "@/lib/adapters/epost";
import { letterPdf, MAX_RECIPIENT_LINES } from "@/server/letter-pdf";

// Briefe (#58): PDF erzeugen und über den gewählten Anbieter versenden.

export type LetterProvider = "PINGEN" | "EPOST";
export type LetterOptions = PingenOptions & EpostOptions;

const PROVIDER_SELECT = {
  pingenClientId: true, pingenClientSecretEnc: true, pingenOrgId: true, pingenStaging: true,
  epostVendorId: true, epostEkp: true, epostPasswordEnc: true, epostSecretEnc: true, epostTest: true,
} as const;

/** Zugangsdaten der eingerichteten Anbieter (entschlüsselt). */
export async function letterProviders(tenantId: string) {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: PROVIDER_SELECT });
  const pingen: PingenConfig | null =
    t?.pingenClientId && t.pingenClientSecretEnc
      ? { clientId: t.pingenClientId, clientSecret: decryptSecret(t.pingenClientSecretEnc), orgId: t.pingenOrgId, staging: t.pingenStaging }
      : null;
  const epost: EpostConfig | null =
    t?.epostVendorId && t.epostEkp && t.epostPasswordEnc && t.epostSecretEnc
      ? { vendorId: t.epostVendorId, ekp: t.epostEkp, password: decryptSecret(t.epostPasswordEnc), secret: decryptSecret(t.epostSecretEnc), test: t.epostTest }
      : null;
  return { pingen, epost };
}

/** Welche Anbieter eingerichtet sind (ohne Secrets zu entschlüsseln), inkl. Testmodus. */
export async function configuredProviders(tenantId: string) {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: PROVIDER_SELECT });
  const list: { id: LetterProvider; test: boolean }[] = [];
  if (t?.pingenClientId && t.pingenClientSecretEnc) list.push({ id: "PINGEN", test: t.pingenStaging });
  if (t?.epostVendorId && t.epostEkp && t.epostPasswordEnc && t.epostSecretEnc) list.push({ id: "EPOST", test: t.epostTest });
  return list;
}

/** Anschrift der Verwaltung ("Straße 1, 12345 Ort" oder zeilenweise) → Zeilen + Ort. */
export function senderLines(address: string | null | undefined) {
  const lines = (address ?? "").split(/\r?\n|,\s*/).map((l) => l.trim()).filter(Boolean);
  const city = lines.map((l) => /^\d{4,5}\s+(.+)$/.exec(l)?.[1]).find(Boolean) ?? "";
  return { lines, city };
}

export type LetterDraft = { recipient: string[]; subject: string; body: string; place: string; date: string };

export async function buildLetterPdf(tenantId: string, d: LetterDraft) {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, address: true, smtpFrom: true } });
  const { lines } = senderLines(t?.address);
  return letterPdf({
    sender: { name: t?.name ?? "", lines: [...lines, ...(t?.smtpFrom ? [t.smtpFrom] : [])] },
    recipient: d.recipient.slice(0, MAX_RECIPIENT_LINES),
    place: d.place,
    date: d.date,
    subject: d.subject,
    body: d.body,
  });
}

/** Gespeicherten Brief beim Anbieter einreichen; aktualisiert Status/ID am Brief. */
export async function submitLetter(tenantId: string, letterId: string, provider: LetterProvider, o: LetterOptions, testEmail?: string) {
  const letter = await prisma.letter.findFirst({ where: { id: letterId, tenantId }, include: { document: true } });
  if (!letter?.document) throw new Error("Brief-PDF nicht gefunden");
  const pdf = await readFile(letter.document.storageKey);
  const cfg = await letterProviders(tenantId);
  const fileName = `Brief_${letter.id}.pdf`;
  let providerId: string;
  let statusText: string;
  let test: boolean; // Testumgebung/Testmodus: nichts wird gedruckt
  if (provider === "PINGEN") {
    if (!cfg.pingen) throw new Error("Pingen ist nicht eingerichtet");
    const r = await pingenSend(cfg.pingen, pdf, fileName, o);
    providerId = r.id;
    statusText = r.status;
    test = !!cfg.pingen.staging;
    if (!cfg.pingen.orgId) await prisma.tenant.update({ where: { id: tenantId }, data: { pingenOrgId: r.orgId } });
  } else {
    if (!cfg.epost) throw new Error("Deutsche Post (E-POST) ist nicht eingerichtet");
    const addr = splitAddress(letter.recipient.split("\n"));
    if (!addr) throw new Error("Die Anschrift braucht eine Zeile „PLZ Ort“");
    const r = await epostSend(cfg.epost, pdf, fileName, addr, o, { testEmail, custom: letter.id });
    providerId = r.id;
    statusText = "";
    test = !!cfg.epost.test;
  }
  await prisma.letter.update({
    where: { id: letter.id },
    data: { provider, providerId, status: "EINGEREICHT", statusText, sentAt: new Date(), options: { ...o, test } },
  });
}

/** Status offener Briefe beim Anbieter abfragen. Liefert die Zahl geänderter Briefe. */
export async function refreshLetterStatus(tenantId: string) {
  const open = await prisma.letter.findMany({
    where: { tenantId, providerId: { not: null }, status: { in: ["EINGEREICHT", "VERSENDET"] } },
    orderBy: { sentAt: "desc" },
    take: 50,
  });
  if (open.length === 0) return 0;
  const cfg = await letterProviders(tenantId);
  let changed = 0;
  for (const l of open) {
    try {
      let status: "EINGEREICHT" | "VERSENDET" | "ZUGESTELLT" | "FEHLER";
      let text: string;
      if (l.provider === "PINGEN" && cfg.pingen) {
        text = await pingenStatus(cfg.pingen, l.providerId!);
        status = mapPingenStatus(text);
      } else if (l.provider === "EPOST" && cfg.epost) {
        const r = await epostStatus(cfg.epost, l.providerId!);
        status = mapEpostStatus(r.statusId);
        text = r.text;
      } else continue;
      if (status !== l.status || text !== (l.statusText ?? "")) {
        await prisma.letter.update({ where: { id: l.id }, data: { status, statusText: text } });
        changed++;
      }
    } catch {
      // einzelner Abruf fehlgeschlagen (Netz, Anbieter): beim nächsten Mal erneut
    }
  }
  return changed;
}

/**
 * Empfänger für „Neuer Brief“: alle Kontakte mit Anschrift. Hat ein Kontakt keine
 * eigene Anschrift, aber einen laufenden Mietvertrag, gilt die Adresse des Objekts.
 */
export async function letterRecipients(tenantId: string) {
  const now = new Date();
  const persons = await prisma.person.findMany({
    where: { tenantId },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true, firstName: true, lastName: true, address: true,
      renters: {
        where: { lease: { startDate: { lte: now }, OR: [{ endDate: null }, { endDate: { gte: now } }] } },
        select: { lease: { select: { unit: { select: { building: { select: { property: { select: { street: true, zip: true, city: true } } } } } } } } },
        take: 1,
      },
    },
  });
  return persons.map((p) => {
    const name = `${p.firstName} ${p.lastName}`.trim();
    const prop = p.renters[0]?.lease.unit.building.property;
    const own = (p.address ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const address = own.length ? own : prop ? [prop.street, `${prop.zip} ${prop.city}`] : [];
    return { id: p.id, label: `${p.lastName}, ${p.firstName}`, address: [name, ...address] };
  });
}
