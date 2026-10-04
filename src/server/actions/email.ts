"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { sendMail, isMailerConfigured, smtpFromAddress, type MailAttachment } from "@/lib/adapters/mailer";
import { readFile, saveFile } from "@/lib/storage";
import { emailSchema, type ActionState } from "@/lib/schemas";
import { renderTemplate } from "@/lib/template";
import { sanitizeMailHtml, isEmptyHtml } from "@/server/mail-sanitize";
import { htmlToText, escapeHtml, textToHtml } from "@/lib/mail-html";
import { wohnungsgeberPdf } from "@/server/wohnungsgeber";
import { messageIdFor, refIds, threadKey } from "@/lib/inbound";
import { threadWhere } from "@/lib/threads";

/**
 * Antwort-Kontext (#43): Vorgänger-Mail (ein- oder ausgehend) → Thread und
 * References. Ohne gültige Angabe: neue Unterhaltung.
 */
async function replyContext(tenantId: string, kind: string, id: string) {
  if (!id) return {};
  const prev =
    kind === "out"
      ? await prisma.emailMessage.findFirst({ where: { id, tenantId }, select: { id: true, threadId: true, messageId: true, references: true } })
      : await prisma.inboundEmail.findFirst({ where: { id, tenantId }, select: { id: true, threadId: true, messageId: true, references: true } });
  if (!prev) return {};
  // Alle bekannten Message-IDs der Unterhaltung, chronologisch (Vorgänger zuletzt),
  // damit das Mailprogramm des Empfängers den Thread auch ohne lückenlose Header erkennt.
  const threadId = threadKey(prev);
  const where = threadWhere(tenantId, threadId);
  const [outs, ins] = await Promise.all([
    prisma.emailMessage.findMany({ where: { ...where, messageId: { not: null } }, select: { messageId: true, createdAt: true } }),
    prisma.inboundEmail.findMany({ where, select: { messageId: true, receivedAt: true } }),
  ]);
  const chain = [...outs.map((o) => ({ id: o.messageId, at: o.createdAt })), ...ins.map((i) => ({ id: i.messageId, at: i.receivedAt }))]
    .sort((x, y) => x.at.getTime() - y.at.getTime())
    .map((x) => x.id ?? "");
  // ponytail: References auf die letzten 20 IDs gekürzt, reicht für jedes Mailprogramm
  const refs = refIds(prev.references, chain.filter((id) => id !== prev.messageId), prev.messageId).slice(-20);
  return { threadId, references: refs.join(" ") || null };
}

const addrList = (s: string | undefined | null) =>
  (s ?? "").split(/[,;]/).map((a) => a.trim()).filter(Boolean);

export async function createEmail(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  // Formatierte Nachricht (#56): HTML bereinigen, Text-Variante serverseitig ableiten.
  const html = sanitizeMailHtml(String(fd.get("html") ?? ""));
  if (isEmptyHtml(html)) return { error: "Nachricht fehlt" };
  const r = emailSchema.safeParse({ ...Object.fromEntries(fd), body: htmlToText(html) });
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Ungültige Eingabe" };

  // Angehängte Dokumente (documentId je Checkbox) — auf Mandant prüfen.
  const docIds = fd.getAll("documentIds").map(String).filter(Boolean);
  if (docIds.length) {
    const count = await prisma.document.count({ where: { id: { in: docIds }, tenantId: user.tenantId } });
    if (count !== docIds.length) return { error: "Dokument nicht gefunden" };
  }

  const reply = await replyContext(user.tenantId, String(fd.get("replyKind") ?? ""), String(fd.get("replyId") ?? ""));
  const msg = await prisma.emailMessage.create({
    data: {
      ...r.data,
      ...reply,
      html,
      tenantId: user.tenantId,
      status: "ENTWURF",
      attachments: { create: docIds.map((documentId) => ({ documentId })) },
    },
  });
  await audit(user, "CREATE", "EmailMessage", msg.id, r.data.subject);
  revalidatePath("/", "layout");
  return { ok: true };
}

async function smtpConfig(tenantId: string) {
  const t = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      smtpHost: true, smtpPort: true, smtpUser: true,
      smtpPassword: true, smtpFrom: true, smtpSecure: true,
    },
  });
  return {
    host: t?.smtpHost, port: t?.smtpPort, user: t?.smtpUser,
    password: t?.smtpPassword, from: t?.smtpFrom, secure: t?.smtpSecure,
  };
}

export async function sendEmail(fd: FormData): Promise<void> {
  const user = await requireWriter();
  const id = String(fd.get("id") ?? "");
  const msg = await prisma.emailMessage.findFirst({
    where: { id, tenantId: user.tenantId },
    include: { attachments: { include: { document: true } } },
  });
  if (!msg) return;

  const cfg = await smtpConfig(user.tenantId);
  const messageId = msg.messageId ?? messageIdFor(msg.id, smtpFromAddress(cfg));
  try {
    // Anhänge aus der Dokumentenablage laden.
    const attachments: MailAttachment[] = [];
    for (const a of msg.attachments) {
      try {
        attachments.push({ filename: a.document.name, content: await readFile(a.document.storageKey) });
      } catch {
        // fehlende Datei überspringen
      }
    }
    await sendMail(
      {
        to: addrList(msg.toAddress),
        cc: addrList(msg.cc),
        bcc: addrList(msg.bcc),
        subject: msg.subject,
        body: msg.body,
        html: msg.html,
        attachments,
        messageId,
        references: refIds(msg.references),
      },
      cfg,
    );
    await prisma.emailMessage.update({
      where: { id: msg.id },
      data: { status: "GESENDET", sentAt: new Date(), error: null, sentById: user.id, messageId },
    });
    await audit(
      user,
      "UPDATE",
      "EmailMessage",
      msg.id,
      isMailerConfigured(cfg) ? "gesendet" : "in Postausgang gestellt (kein SMTP)",
    );
  } catch (e) {
    await prisma.emailMessage.update({
      where: { id: msg.id },
      data: { status: "FEHLER", error: e instanceof Error ? e.message : "Versand fehlgeschlagen" },
    });
  }
  revalidatePath("/", "layout");
}

/** Serien-Mail: Entwurf je Mieter oder Eigentümer eines Objekts. */
export async function bulkEmail(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const propertyId = String(fd.get("propertyId") ?? "");
  const audience = String(fd.get("audience") ?? "");
  const subject = String(fd.get("subject") ?? "").trim();
  const html = sanitizeMailHtml(String(fd.get("html") ?? ""));
  if (!propertyId || !subject || isEmptyHtml(html)) return { error: "Objekt, Betreff und Nachricht erforderlich." };

  const prop = await prisma.property.findFirst({
    where: { id: propertyId, tenantId: user.tenantId },
    select: { name: true },
  });
  const objektName = prop?.name ?? "";
  const datum = new Date().toLocaleDateString("de-DE");

  // Empfänger mit Kontext einsammeln (dedupliziert je E-Mail).
  const recips = new Map<string, { name: string; nameKey: string }>();
  if (audience === "EIGENTUEMER") {
    const owners = await prisma.owner.findMany({
      where: { tenantId: user.tenantId, unit: { building: { propertyId } } },
      include: { person: { select: { email: true, firstName: true, lastName: true } } },
    });
    owners.forEach((o) => {
      if (o.person.email)
        recips.set(o.person.email, {
          name: `${o.person.firstName} ${o.person.lastName}`,
          nameKey: "eigentuemer.name",
        });
    });
  } else {
    const renters = await prisma.renter.findMany({
      where: { tenantId: user.tenantId, lease: { unit: { building: { propertyId } } } },
      include: { person: { select: { email: true, firstName: true, lastName: true } } },
    });
    renters.forEach((r) => {
      if (r.person.email)
        recips.set(r.person.email, {
          name: `${r.person.firstName} ${r.person.lastName}`,
          nameKey: "mieter.name",
        });
    });
  }
  if (recips.size === 0) return { error: "Keine Empfänger mit E-Mail-Adresse gefunden." };

  // Optionale Dokumentanhänge (je Empfänger dieselben) — auf Mandant prüfen.
  const docIds = fd.getAll("documentIds").map(String).filter(Boolean);
  if (docIds.length) {
    const cnt = await prisma.document.count({ where: { tenantId: user.tenantId, id: { in: docIds } } });
    if (cnt !== docIds.length) return { error: "Dokument nicht gefunden." };
  }

  // Platzhalter je Empfänger füllen (Serienbrief).
  const rows = [...recips.entries()].map(([to, ctx]) => {
    const context: Record<string, string> = {
      "objekt.name": objektName,
      datum,
      [ctx.nameKey]: ctx.name,
      "mieter.name": ctx.name,
      "eigentuemer.name": ctx.name,
    };
    return {
      tenantId: user.tenantId,
      toAddress: to,
      subject: renderTemplate(subject, context),
      // Platzhalter im HTML mit maskierten Werten füllen (Namen dürfen kein Markup einschleusen)
      ...(() => {
        const htmlCtx = Object.fromEntries(Object.entries(context).map(([k, v]) => [k, escapeHtml(v)]));
        const rendered = renderTemplate(html, htmlCtx);
        return { html: rendered, body: htmlToText(rendered) };
      })(),
      status: "ENTWURF" as const,
    };
  });

  // Nicht createMany: Anhänge sind eine verschachtelte Relation, daher je Mail.
  for (const row of rows) {
    await prisma.emailMessage.create({
      data: {
        ...row,
        ...(docIds.length ? { attachments: { create: docIds.map((documentId) => ({ documentId })) } } : {}),
      },
    });
  }
  await audit(user, "CREATE", "EmailMessage", null, `Serien-Mail (${rows.length})`);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteEmail(fd: FormData): Promise<void> {
  const user = await requireWriter();
  const id = String(fd.get("id") ?? "");
  const res = await prisma.emailMessage.deleteMany({ where: { id, tenantId: user.tenantId } });
  if (res.count > 0) await audit(user, "DELETE", "EmailMessage", id);
  revalidatePath("/", "layout");
}

/**
 * Wohnungsgeberbestätigung (#55) erzeugen, als Dokument am Mieter ablegen und per
 * E-Mail an die Mieter senden (landet wie jede Mail im Postausgang/Verlauf).
 */
export async function sendWohnungsgeber(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const opt = Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)]));
  const res = await wohnungsgeberPdf(user.tenantId, String(fd.get("leaseId") ?? ""), opt);
  if (!res) return { error: "Mietvertrag nicht gefunden" };
  const { lease, property, pdf } = res;
  const renters = lease.renters.filter((r) => r.person.email);
  if (renters.length === 0) return { error: "Kein Mieter mit E-Mail-Adresse hinterlegt" };

  const storageKey = await saveFile(pdf, "wohnungsgeberbestaetigung.pdf");
  const doc = await prisma.document.create({
    data: {
      tenantId: user.tenantId, propertyId: property.id, unitId: lease.unitId, personId: renters[0].personId,
      name: `Wohnungsgeberbestätigung ${property.name} ${lease.unit.label}.pdf`, category: "VERTRAG",
      mime: "application/pdf", size: pdf.length, storageKey,
    },
  });
  const names = renters.map((r) => `${r.person.firstName} ${r.person.lastName}`).join(", ");
  const text =
    `Guten Tag ${names},\n\nanbei erhalten Sie die Wohnungsgeberbestätigung für Ihre Wohnung ` +
    `${property.street}, ${property.zip} ${property.city} (${lease.unit.label}). ` +
    `Bitte legen Sie sie bei der Anmeldung beim Bürgeramt vor.\n\nMit freundlichen Grüßen\n${property.tenant.name}`;
  const msg = await prisma.emailMessage.create({
    data: {
      tenantId: user.tenantId,
      toAddress: renters.map((r) => r.person.email!).join(", "),
      subject: "Ihre Wohnungsgeberbestätigung",
      body: text,
      html: textToHtml(text),
      status: "ENTWURF",
      attachments: { create: [{ documentId: doc.id }] },
    },
  });
  await audit(user, "CREATE", "EmailMessage", msg.id, "Wohnungsgeberbestätigung");
  const sendFd = new FormData();
  sendFd.set("id", msg.id);
  await sendEmail(sendFd);
  const sent = await prisma.emailMessage.findUnique({ where: { id: msg.id }, select: { status: true, error: true } });
  if (sent?.status === "FEHLER") return { error: `Versand fehlgeschlagen: ${sent.error ?? ""}` };
  return { ok: true };
}
