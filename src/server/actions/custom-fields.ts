"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/rbac";
import { customFieldDefSchema, type ActionState } from "@/lib/schemas";

export async function createCustomFieldDef(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const r = customFieldDefSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Ungültige Eingabe" };
  const exists = await prisma.customFieldDef.findFirst({
    where: { tenantId: user.tenantId, entity: r.data.entity, key: r.data.key },
    select: { id: true },
  });
  if (exists) return { error: "Feld-Schlüssel existiert bereits" };
  await prisma.customFieldDef.create({ data: { ...r.data, tenantId: user.tenantId } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteCustomFieldDef(fd: FormData): Promise<void> {
  const user = await requireWriter();
  await prisma.customFieldDef.deleteMany({
    where: { id: String(fd.get("id") ?? ""), tenantId: user.tenantId },
  });
  revalidatePath("/", "layout");
}
