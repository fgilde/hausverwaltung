"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/rbac";
import { insuranceSchema, propertyTaxSchema, type ActionState } from "@/lib/schemas";

async function assertProperty(tenantId: string, propertyId: string) {
  return prisma.property.findFirst({ where: { id: propertyId, tenantId }, select: { id: true } });
}

// --- Versicherung ---
export async function createInsurance(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const r = insuranceSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Ungültige Eingabe" };
  if (!(await assertProperty(user.tenantId, r.data.propertyId))) return { error: "Objekt nicht gefunden" };
  await prisma.insurance.create({ data: { ...r.data, tenantId: user.tenantId } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteInsurance(fd: FormData): Promise<void> {
  const user = await requireWriter();
  await prisma.insurance.deleteMany({ where: { id: String(fd.get("id") ?? ""), tenantId: user.tenantId } });
  revalidatePath("/", "layout");
}

// --- Grundsteuer (upsert je Objekt) ---
export async function upsertPropertyTax(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const r = propertyTaxSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Ungültige Eingabe" };
  if (!(await assertProperty(user.tenantId, r.data.propertyId))) return { error: "Objekt nicht gefunden" };
  const { propertyId, ...data } = r.data;
  await prisma.propertyTax.upsert({
    where: { propertyId },
    create: { ...r.data, tenantId: user.tenantId },
    update: data,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deletePropertyTax(fd: FormData): Promise<void> {
  const user = await requireWriter();
  await prisma.propertyTax.deleteMany({ where: { id: String(fd.get("id") ?? ""), tenantId: user.tenantId } });
  revalidatePath("/", "layout");
}
