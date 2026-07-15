"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/rbac";
import {
  leaseCreateSchema,
  leaseUpdateSchema,
  rentComponentSchema,
  rentAdjustmentSchema,
  depositSchema,
  renterSchema,
  type ActionState,
} from "@/lib/schemas";

function fail(msg?: string): ActionState {
  return { error: msg ?? "Ungültige Eingabe" };
}
function done(): ActionState {
  revalidatePath("/", "layout");
  return { ok: true };
}

// --- Lease ---
export async function createLease(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const r = leaseCreateSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return fail(r.error.issues[0]?.message);
  const [unit, person] = await Promise.all([
    prisma.unit.findFirst({ where: { id: r.data.unitId, tenantId: user.tenantId }, select: { id: true } }),
    prisma.person.findFirst({ where: { id: r.data.personId, tenantId: user.tenantId }, select: { id: true } }),
  ]);
  if (!unit || !person) return fail("Einheit oder Person nicht gefunden");
  const { unitId, personId, ...data } = r.data;
  await prisma.lease.create({
    data: {
      ...data,
      tenantId: user.tenantId,
      unitId,
      renters: { create: { tenantId: user.tenantId, personId } },
    },
  });
  return done();
}

export async function updateLease(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const id = String(fd.get("id") ?? "");
  const r = leaseUpdateSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return fail(r.error.issues[0]?.message);
  await prisma.lease.updateMany({ where: { id, tenantId: user.tenantId }, data: r.data });
  return done();
}

export async function deleteLease(fd: FormData): Promise<void> {
  const user = await requireWriter();
  await prisma.lease.deleteMany({ where: { id: String(fd.get("id") ?? ""), tenantId: user.tenantId } });
  revalidatePath("/", "layout");
}

// --- Renter (Mitmieter) ---
async function assertLease(tenantId: string, leaseId: string) {
  return prisma.lease.findFirst({ where: { id: leaseId, tenantId }, select: { id: true } });
}

export async function addRenter(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const r = renterSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return fail(r.error.issues[0]?.message);
  if (!(await assertLease(user.tenantId, r.data.leaseId))) return fail("Vertrag nicht gefunden");
  await prisma.renter.create({ data: { ...r.data, tenantId: user.tenantId } });
  return done();
}

export async function deleteRenter(fd: FormData): Promise<void> {
  const user = await requireWriter();
  await prisma.renter.deleteMany({ where: { id: String(fd.get("id") ?? ""), tenantId: user.tenantId } });
  revalidatePath("/", "layout");
}

// --- RentComponent ---
export async function createComponent(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const r = rentComponentSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return fail(r.error.issues[0]?.message);
  if (!(await assertLease(user.tenantId, r.data.leaseId))) return fail("Vertrag nicht gefunden");
  await prisma.rentComponent.create({ data: { ...r.data, tenantId: user.tenantId } });
  return done();
}

export async function deleteComponent(fd: FormData): Promise<void> {
  const user = await requireWriter();
  await prisma.rentComponent.deleteMany({ where: { id: String(fd.get("id") ?? ""), tenantId: user.tenantId } });
  revalidatePath("/", "layout");
}

// --- RentAdjustment ---
export async function createAdjustment(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const r = rentAdjustmentSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return fail(r.error.issues[0]?.message);
  if (!(await assertLease(user.tenantId, r.data.leaseId))) return fail("Vertrag nicht gefunden");
  await prisma.rentAdjustment.create({ data: { ...r.data, tenantId: user.tenantId } });
  return done();
}

// Anpassung anwenden: setzt Kaltmiete des Vertrags auf newRentCold.
export async function applyAdjustment(fd: FormData): Promise<void> {
  const user = await requireWriter();
  const id = String(fd.get("id") ?? "");
  const adj = await prisma.rentAdjustment.findFirst({
    where: { id, tenantId: user.tenantId },
    include: { lease: { select: { id: true, tenantId: true } } },
  });
  if (adj && adj.lease.tenantId === user.tenantId) {
    await prisma.$transaction([
      prisma.lease.update({ where: { id: adj.leaseId }, data: { rentCold: adj.newRentCold } }),
      prisma.rentAdjustment.update({ where: { id: adj.id }, data: { applied: true } }),
    ]);
  }
  revalidatePath("/", "layout");
}

export async function deleteAdjustment(fd: FormData): Promise<void> {
  const user = await requireWriter();
  await prisma.rentAdjustment.deleteMany({ where: { id: String(fd.get("id") ?? ""), tenantId: user.tenantId } });
  revalidatePath("/", "layout");
}

// --- Deposit ---
export async function upsertDeposit(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const r = depositSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return fail(r.error.issues[0]?.message);
  if (!(await assertLease(user.tenantId, r.data.leaseId))) return fail("Vertrag nicht gefunden");
  const { leaseId, ...data } = r.data;
  await prisma.deposit.upsert({
    where: { leaseId },
    create: { ...r.data, tenantId: user.tenantId },
    update: data,
  });
  return done();
}

export async function deleteDeposit(fd: FormData): Promise<void> {
  const user = await requireWriter();
  await prisma.deposit.deleteMany({ where: { id: String(fd.get("id") ?? ""), tenantId: user.tenantId } });
  revalidatePath("/", "layout");
}
