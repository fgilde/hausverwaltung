"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/rbac";
import { templateSchema, type ActionState } from "@/lib/schemas";
import { isEmptyHtml, sanitizeMailHtml } from "@/server/mail-sanitize";

// Vorlagentext kommt als Editor-HTML (#98): wie Mails bereinigen, leeren Editor ablehnen.
function parseTemplate(fd: FormData) {
  const r = templateSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Ungültige Eingabe" };
  if (isEmptyHtml(r.data.body)) return { error: "Text fehlt" };
  return { data: { ...r.data, body: sanitizeMailHtml(r.data.body) } };
}

export async function createTemplate(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const r = parseTemplate(fd);
  if (!r.data) return { error: r.error };
  await prisma.template.create({ data: { ...r.data, tenantId: user.tenantId } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateTemplate(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const id = String(fd.get("id") ?? "");
  const r = parseTemplate(fd);
  if (!r.data) return { error: r.error };
  await prisma.template.updateMany({ where: { id, tenantId: user.tenantId }, data: r.data });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteTemplate(fd: FormData): Promise<void> {
  const user = await requireWriter();
  await prisma.template.deleteMany({ where: { id: String(fd.get("id") ?? ""), tenantId: user.tenantId } });
  revalidatePath("/", "layout");
}
