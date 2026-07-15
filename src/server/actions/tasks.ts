"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/rbac";
import { taskSchema, type ActionState } from "@/lib/schemas";

export async function createTask(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const r = taskSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Ungültige Eingabe" };
  await prisma.task.create({ data: { ...r.data, tenantId: user.tenantId } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function toggleTask(fd: FormData): Promise<void> {
  const user = await requireWriter();
  const id = String(fd.get("id") ?? "");
  const task = await prisma.task.findFirst({ where: { id, tenantId: user.tenantId } });
  if (task) await prisma.task.update({ where: { id: task.id }, data: { done: !task.done } });
  revalidatePath("/", "layout");
}

export async function deleteTask(fd: FormData): Promise<void> {
  const user = await requireWriter();
  await prisma.task.deleteMany({ where: { id: String(fd.get("id") ?? ""), tenantId: user.tenantId } });
  revalidatePath("/", "layout");
}
