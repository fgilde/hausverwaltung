"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { syncTenantInbox } from "@/lib/inbound-sync";
import { threadWhere } from "@/lib/threads";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import type { Prisma } from "@prisma/client";
import { deleteFile, readFile } from "@/lib/storage";
import { documentEditSchema } from "@/lib/schemas";
import { isEInvoice, parseEInvoice } from "@/lib/adapters/erechnung";
import type { ActionState } from "@/lib/schemas";

/** Manueller Abruf des IMAP-Postfachs (Button in den Einstellungen). */
export async function syncInbox(_p: ActionState, _fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const res = await syncTenantInbox(user.tenantId);
  if ("error" in res) return { error: res.error };
  if (res.imported > 0) await audit(user, "CREATE", "InboundEmail", null, `${res.imported} eingegangen, ${res.matched} zugeordnet`);
  revalidatePath("/", "layout");
  return { ok: true, error: `${res.imported} neue Mails, ${res.matched} zugeordnet` };
}

/** Gelesen/erledigt im Posteingang setzen oder zurücknehmen (#43). */
export async function setInboundFlag(fd: FormData): Promise<void> {
  const user = await requireWriter();
  const id = String(fd.get("id") ?? "");
  const field = fd.get("flag") === "done" ? "doneAt" : "readAt";
  const on = fd.get("value") !== "false";
  await prisma.inboundEmail.updateMany({
    where: { id, tenantId: user.tenantId },
    data: { [field]: on ? new Date() : null },
  });
  revalidatePath("/", "layout");
}

/** Beim Öffnen einer ungelesenen Mail (Ansicht-Dialog). */
export async function markInboundRead(id: string): Promise<void> {
  const user = await requireWriter();
  await prisma.inboundEmail.updateMany({ where: { id, tenantId: user.tenantId, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/", "layout");
}

/** Ganze Unterhaltung erledigt/offen: betrifft alle eingegangenen Mails darin. */
export async function setThreadDone(fd: FormData): Promise<void> {
  const user = await requireWriter();
  const key = String(fd.get("key") ?? "");
  const on = fd.get("value") !== "false";
  if (!key) return;
  await prisma.inboundEmail.updateMany({ where: threadWhere(user.tenantId, key), data: { doneAt: on ? new Date() : null } });
  revalidatePath("/", "layout");
}

/** Anhang einer eingehenden Mail als Dokument übernehmen (#52), Datei wird geteilt. */
export async function importInboundAttachment(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const id = String(fd.get("attachmentId") ?? "");
  const r = documentEditSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Ungültige Eingabe" };
  const { name, category, propertyId, unitId, personId } = r.data;

  const att = await prisma.inboundEmailAttachment.findFirst({ where: { id, inboundEmail: { tenantId: user.tenantId } } });
  if (!att) return { error: "Anhang nicht gefunden" };
  if (att.documentId) return { error: "Anhang wurde bereits übernommen" };
  const t = user.tenantId;
  if (propertyId && !(await prisma.property.findFirst({ where: { id: propertyId, tenantId: t }, select: { id: true } }))) return { error: "Objekt nicht gefunden" };
  if (unitId && !(await prisma.unit.findFirst({ where: { id: unitId, tenantId: t }, select: { id: true } }))) return { error: "Einheit nicht gefunden" };
  if (personId && !(await prisma.person.findFirst({ where: { id: personId, tenantId: t }, select: { id: true } }))) return { error: "Person nicht gefunden" };

  // E-Rechnung wie beim Upload erkennen und auslesen.
  const eInvoice = isEInvoice(att.mime, att.name) || category === "ERECHNUNG";
  const parsed = eInvoice ? parseEInvoice(await readFile(att.storageKey), att.mime) : null;
  const doc = await prisma.document.create({
    data: {
      tenantId: t, name, category, propertyId: propertyId ?? null, unitId: unitId ?? null, personId: personId ?? null,
      mime: att.mime, size: att.size, storageKey: att.storageKey,
      eInvoice, invoiceNo: parsed?.invoiceNumber ?? null, invoiceTotal: parsed?.total ?? null,
    },
  });
  await prisma.inboundEmailAttachment.update({ where: { id: att.id }, data: { documentId: doc.id } });
  await audit(user, "CREATE", "Document", doc.id, `${name} (aus E-Mail übernommen)`);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Eingegangene Mails löschen (#50): nicht übernommene Anhang-Dateien mit, übernommene Dokumente bleiben. */
async function removeInbound(tenantId: string, where: Prisma.InboundEmailWhereInput) {
  const mails = await prisma.inboundEmail.findMany({
    where: { ...where, tenantId },
    select: { id: true, attachments: { where: { documentId: null }, select: { storageKey: true } } },
  });
  for (const m of mails) for (const a of m.attachments) await deleteFile(a.storageKey);
  await prisma.inboundEmail.deleteMany({ where: { id: { in: mails.map((m) => m.id) }, tenantId } });
  return mails.length;
}

export async function deleteInboundEmail(fd: FormData): Promise<void> {
  const user = await requireWriter();
  const id = String(fd.get("id") ?? "");
  if (await removeInbound(user.tenantId, { id })) await audit(user, "DELETE", "InboundEmail", id);
  revalidatePath("/", "layout");
}

/** Ganze Unterhaltung löschen (#50): eingehende und ausgehende Mails. */
export async function deleteThread(fd: FormData): Promise<void> {
  const user = await requireWriter();
  const key = String(fd.get("id") ?? "");
  if (!key) return;
  const where = threadWhere(user.tenantId, key);
  const inbound = await removeInbound(user.tenantId, where);
  const outbound = await prisma.emailMessage.deleteMany({ where });
  await audit(user, "DELETE", "EmailThread", key, `${inbound} eingehend, ${outbound.count} ausgehend`);
  revalidatePath("/", "layout");
  redirect({ href: "/email", locale: await getLocale() });
}
