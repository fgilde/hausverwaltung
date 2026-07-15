"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { sendMail, isMailerConfigured, type MailAttachment } from "@/lib/adapters/mailer";
import { readFile } from "@/lib/storage";
import { emailSchema, type ActionState } from "@/lib/schemas";

const addrList = (s: string | undefined | null) =>
  (s ?? "").split(/[,;]/).map((a) => a.trim()).filter(Boolean);

export async function createEmail(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const r = emailSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Ungültige Eingabe" };

  // Angehängte Dokumente (documentId je Checkbox) — auf Mandant prüfen.
  const docIds = fd.getAll("documentIds").map(String).filter(Boolean);
  if (docIds.length) {
    const count = await prisma.document.count({ where: { id: { in: docIds }, tenantId: user.tenantId } });
    if (count !== docIds.length) return { error: "Dokument nicht gefunden" };
  }

  const msg = await prisma.emailMessage.create({
    data: {
      ...r.data,
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
        attachments,
      },
      cfg,
    );
    await prisma.emailMessage.update({
      where: { id: msg.id },
      data: { status: "GESENDET", sentAt: new Date(), error: null },
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
  const body = String(fd.get("body") ?? "").trim();
  if (!propertyId || !subject || !body) return { error: "Objekt, Betreff und Nachricht erforderlich." };

  const emails = new Set<string>();
  if (audience === "EIGENTUEMER") {
    const owners = await prisma.owner.findMany({
      where: { tenantId: user.tenantId, unit: { building: { propertyId } } },
      include: { person: { select: { email: true } } },
    });
    owners.forEach((o) => o.person.email && emails.add(o.person.email));
  } else {
    const renters = await prisma.renter.findMany({
      where: { tenantId: user.tenantId, lease: { unit: { building: { propertyId } } } },
      include: { person: { select: { email: true } } },
    });
    renters.forEach((r) => r.person.email && emails.add(r.person.email));
  }
  if (emails.size === 0) return { error: "Keine Empfänger mit E-Mail-Adresse gefunden." };

  await prisma.emailMessage.createMany({
    data: [...emails].map((to) => ({ tenantId: user.tenantId, toAddress: to, subject, body, status: "ENTWURF" as const })),
  });
  await audit(user, "CREATE", "EmailMessage", null, `Serien-Mail (${emails.size})`);
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
