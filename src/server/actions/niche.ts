"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/rbac";
import { insuranceSchema, propertyTaxSchema, type ActionState } from "@/lib/schemas";

async function assertProperty(tenantId: string, propertyId: string) {
  return prisma.property.findFirst({ where: { id: propertyId, tenantId }, select: { id: true } });
}

// Kostenposition je Objekt/Jahr/Typ anlegen oder aktualisieren (kein Doppelbuchen).
async function upsertCost(
  tenantId: string,
  propertyId: string,
  year: number,
  type: "GRUNDSTEUER" | "VERSICHERUNG",
  amount: number,
) {
  const existing = await prisma.costEntry.findFirst({ where: { tenantId, propertyId, year, type } });
  if (existing) {
    await prisma.costEntry.update({ where: { id: existing.id }, data: { amount } });
  } else {
    await prisma.costEntry.create({
      data: { tenantId, propertyId, year, type, amount, method: "AREA", umlagefaehig: true },
    });
  }
}

// Grundsteuer als Kostenposition (BetrKV) buchen — statt separatem Reiter.
export async function bookGrundsteuerAsCost(fd: FormData): Promise<void> {
  const user = await requireWriter();
  const propertyId = String(fd.get("propertyId") ?? "");
  const year = Number(fd.get("year")) || new Date().getFullYear();
  const tax = await prisma.propertyTax.findFirst({ where: { propertyId, tenantId: user.tenantId } });
  if (!tax) return;
  const amount = tax.messbetrag && tax.hebesatz ? (Number(tax.messbetrag) * Number(tax.hebesatz)) / 100 : 0;
  if (amount <= 0) return;
  await upsertCost(user.tenantId, propertyId, year, "GRUNDSTEUER", Math.round(amount * 100) / 100);
  revalidatePath("/", "layout");
}

// Versicherung als Kostenposition (BetrKV) buchen.
export async function bookInsuranceAsCost(fd: FormData): Promise<void> {
  const user = await requireWriter();
  const id = String(fd.get("id") ?? "");
  const year = Number(fd.get("year")) || new Date().getFullYear();
  const ins = await prisma.insurance.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!ins || Number(ins.premium) <= 0) return;
  await upsertCost(user.tenantId, ins.propertyId, year, "VERSICHERUNG", Number(ins.premium));
  revalidatePath("/", "layout");
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
