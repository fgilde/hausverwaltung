"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/rbac";
import { costEntrySchema, type ActionState } from "@/lib/schemas";

export async function createCost(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const r = costEntrySchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Ungültige Eingabe" };
  const prop = await prisma.property.findFirst({
    where: { id: r.data.propertyId, tenantId: user.tenantId },
    select: { id: true },
  });
  if (!prop) return { error: "Objekt nicht gefunden" };
  await prisma.costEntry.create({ data: { ...r.data, tenantId: user.tenantId } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteCost(fd: FormData): Promise<void> {
  const user = await requireWriter();
  await prisma.costEntry.deleteMany({ where: { id: String(fd.get("id") ?? ""), tenantId: user.tenantId } });
  revalidatePath("/", "layout");
}
