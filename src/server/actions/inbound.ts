"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { syncTenantInbox } from "@/lib/inbound-sync";
import { threadWhere } from "@/lib/threads";
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
