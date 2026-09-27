"use server";

import { revalidatePath } from "next/cache";
import { requireWriter } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { syncTenantInbox } from "@/lib/inbound-sync";
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
