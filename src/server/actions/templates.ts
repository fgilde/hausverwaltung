"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/rbac";
import { templateSchema, type ActionState } from "@/lib/schemas";

export async function createTemplate(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const r = templateSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Ungültige Eingabe" };
  await prisma.template.create({ data: { ...r.data, tenantId: user.tenantId } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateTemplate(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const id = String(fd.get("id") ?? "");
  const r = templateSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Ungültige Eingabe" };
  await prisma.template.updateMany({ where: { id, tenantId: user.tenantId }, data: r.data });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteTemplate(fd: FormData): Promise<void> {
  const user = await requireWriter();
  await prisma.template.deleteMany({ where: { id: String(fd.get("id") ?? ""), tenantId: user.tenantId } });
  revalidatePath("/", "layout");
}
