"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/rbac";
import {
  ownerSchema,
  economicPlanSchema,
  reserveSchema,
  reserveTxSchema,
  type ActionState,
} from "@/lib/schemas";

function fail(msg?: string): ActionState {
  return { error: msg ?? "Ungültige Eingabe" };
}
function done(): ActionState {
  revalidatePath("/", "layout");
  return { ok: true };
}

// --- Owner (Eigentümer ↔ Einheit) ---
export async function createOwner(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const r = ownerSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return fail(r.error.issues[0]?.message);
  const [unit, person] = await Promise.all([
    prisma.unit.findFirst({ where: { id: r.data.unitId, tenantId: user.tenantId }, select: { id: true } }),
    prisma.person.findFirst({ where: { id: r.data.personId, tenantId: user.tenantId }, select: { id: true } }),
  ]);
  if (!unit || !person) return fail("Einheit oder Person nicht gefunden");
  await prisma.owner.create({ data: { ...r.data, tenantId: user.tenantId } });
  return done();
}
export async function deleteOwner(fd: FormData): Promise<void> {
  const user = await requireWriter();
  await prisma.owner.deleteMany({ where: { id: String(fd.get("id") ?? ""), tenantId: user.tenantId } });
  revalidatePath("/", "layout");
}

// --- Wirtschaftsplan (upsert je Objekt+Jahr) ---
export async function upsertEconomicPlan(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const r = economicPlanSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return fail(r.error.issues[0]?.message);
  const prop = await prisma.property.findFirst({ where: { id: r.data.propertyId, tenantId: user.tenantId }, select: { id: true } });
  if (!prop) return fail("Objekt nicht gefunden");
  const { propertyId, year, ...data } = r.data;
  await prisma.economicPlan.upsert({
    where: { propertyId_year: { propertyId, year } },
    create: { ...r.data, tenantId: user.tenantId },
    update: data,
  });
  return done();
}
export async function deleteEconomicPlan(fd: FormData): Promise<void> {
  const user = await requireWriter();
  await prisma.economicPlan.deleteMany({ where: { id: String(fd.get("id") ?? ""), tenantId: user.tenantId } });
  revalidatePath("/", "layout");
}

// --- Rücklage ---
export async function createReserve(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const r = reserveSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return fail(r.error.issues[0]?.message);
  const prop = await prisma.property.findFirst({ where: { id: r.data.propertyId, tenantId: user.tenantId }, select: { id: true } });
  if (!prop) return fail("Objekt nicht gefunden");
  await prisma.reserve.create({ data: { ...r.data, tenantId: user.tenantId } });
  return done();
}
export async function deleteReserve(fd: FormData): Promise<void> {
  const user = await requireWriter();
  await prisma.reserve.deleteMany({ where: { id: String(fd.get("id") ?? ""), tenantId: user.tenantId } });
  revalidatePath("/", "layout");
}

export async function createReserveTx(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const r = reserveTxSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return fail(r.error.issues[0]?.message);
  const res = await prisma.reserve.findFirst({ where: { id: r.data.reserveId, tenantId: user.tenantId }, select: { id: true } });
  if (!res) return fail("Rücklage nicht gefunden");
  await prisma.reserveTransaction.create({ data: { ...r.data, tenantId: user.tenantId } });
  return done();
}
export async function deleteReserveTx(fd: FormData): Promise<void> {
  const user = await requireWriter();
  await prisma.reserveTransaction.deleteMany({ where: { id: String(fd.get("id") ?? ""), tenantId: user.tenantId } });
  revalidatePath("/", "layout");
}
