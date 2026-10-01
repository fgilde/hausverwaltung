"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/rbac";
import {
  ownerSchema,
  economicPlanSchema,
  reserveSchema,
  reserveTxSchema,
  subcommunitySchema,
  type ActionState,
} from "@/lib/schemas";
import { subcommunityValid } from "@/server/weg";
import { unitShareSum } from "@/lib/weg-validation";

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
  // Summe der Eigentümeranteile je Einheit darf 1000 (100 %) nicht überschreiten.
  const existing = await prisma.owner.aggregate({
    where: { unitId: r.data.unitId, tenantId: user.tenantId },
    _sum: { share: true },
  });
  if (unitShareSum([existing._sum.share ?? 0, r.data.share]) > 1000) {
    return fail("Summe der Eigentümeranteile dieser Einheit überschreitet 1000‰");
  }
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
  // Wirtschaftsplan einer Untergemeinschaft (#42) separat, sonst Gesamt-WEG.
  const subcommunityId = String(fd.get("subcommunityId") ?? "");
  if (subcommunityId) {
    if (!(await subcommunityValid(user.tenantId, propertyId, subcommunityId))) return fail("Untergemeinschaft nicht gefunden");
    await prisma.subcommunityPlan.upsert({
      where: { subcommunityId_year: { subcommunityId, year } },
      create: { ...data, subcommunityId, year, tenantId: user.tenantId },
      update: data,
    });
    return done();
  }
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
  if (!(await subcommunityValid(user.tenantId, r.data.propertyId, r.data.subcommunityId))) return fail("Untergemeinschaft nicht gefunden");
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

// --- Untergemeinschaften (#42) ---
export async function createSubcommunity(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const r = subcommunitySchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return fail(r.error.issues[0]?.message);
  const prop = await prisma.property.findFirst({ where: { id: r.data.propertyId, tenantId: user.tenantId, management: "WEG" }, select: { id: true } });
  if (!prop) return fail("Objekt nicht gefunden");
  const sub = await prisma.subcommunity.create({ data: { ...r.data, tenantId: user.tenantId } });
  await assignUnits(user.tenantId, r.data.propertyId, sub.id, fd.getAll("unitIds").map(String));
  return done();
}

export async function updateSubcommunity(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const id = String(fd.get("id") ?? "");
  const name = String(fd.get("name") ?? "").trim();
  if (!name) return fail("Name fehlt");
  const sub = await prisma.subcommunity.findFirst({ where: { id, tenantId: user.tenantId }, select: { id: true, propertyId: true } });
  if (!sub) return fail("Untergemeinschaft nicht gefunden");
  await prisma.subcommunity.update({ where: { id }, data: { name } });
  await assignUnits(user.tenantId, sub.propertyId, id, fd.getAll("unitIds").map(String));
  return done();
}

/** Einheiten der UG setzen: angehakte zuordnen (ggf. aus anderer UG), übrige lösen. */
async function assignUnits(tenantId: string, propertyId: string, subcommunityId: string, unitIds: string[]) {
  const scope = { tenantId, building: { propertyId } };
  await prisma.$transaction([
    prisma.unit.updateMany({ where: { ...scope, subcommunityId, id: { notIn: unitIds } }, data: { subcommunityId: null } }),
    prisma.unit.updateMany({ where: { ...scope, id: { in: unitIds } }, data: { subcommunityId } }),
  ]);
}

export async function deleteSubcommunity(fd: FormData): Promise<void> {
  const user = await requireWriter();
  await prisma.subcommunity.deleteMany({ where: { id: String(fd.get("id") ?? ""), tenantId: user.tenantId } });
  revalidatePath("/", "layout");
}
