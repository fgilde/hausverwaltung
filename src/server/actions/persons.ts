"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/rbac";
import { personSchema, type ActionState } from "@/lib/schemas";

export async function createPerson(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const r = personSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Ungültige Eingabe" };
  await prisma.person.create({ data: { ...r.data, tenantId: user.tenantId } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updatePerson(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const id = String(fd.get("id") ?? "");
  const r = personSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Ungültige Eingabe" };
  await prisma.person.updateMany({ where: { id, tenantId: user.tenantId }, data: r.data });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deletePerson(fd: FormData): Promise<void> {
  const user = await requireWriter();
  await prisma.person.deleteMany({
    where: { id: String(fd.get("id") ?? ""), tenantId: user.tenantId },
  });
  revalidatePath("/", "layout");
}
