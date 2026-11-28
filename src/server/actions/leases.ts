"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/rbac";
import { pickCustom } from "@/lib/custom";
import {
  leaseCreateSchema,
  leaseUpdateSchema,
  rentComponentSchema,
  componentAdjustSchema,
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
  const entries = Object.fromEntries(fd);
  const r = leaseCreateSchema.safeParse(entries);
  if (!r.success) return fail(r.error.issues[0]?.message);

  // Mehrere Mieter möglich (personIds als Mehrfachfeld); Duplikate entfernen.
  const personIds = [...new Set(fd.getAll("personIds").map(String).filter(Boolean))];
  if (personIds.length === 0) return fail("Mindestens eine Person wählen");

  const [unit, persons] = await Promise.all([
    prisma.unit.findFirst({ where: { id: r.data.unitId, tenantId: user.tenantId }, select: { id: true } }),
    prisma.person.findMany({ where: { id: { in: personIds }, tenantId: user.tenantId }, select: { id: true } }),
  ]);
  if (!unit) return fail("Einheit nicht gefunden");
  if (persons.length !== personIds.length) return fail("Person nicht gefunden");

  // personId (API-Feld) hier verwerfen — das Web-Formular nutzt personIds.
  const { unitId, personId: _ignored, ...data } = r.data;
  void _ignored;
  await prisma.lease.create({
    data: {
      ...data,
      custom: pickCustom(entries),
      tenantId: user.tenantId,
      unitId,
      renters: { create: personIds.map((personId) => ({ tenantId: user.tenantId, personId })) },
    },
  });
  return done();
}

export async function updateLease(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const id = String(fd.get("id") ?? "");
  const r = leaseUpdateSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return fail(r.error.issues[0]?.message);
  // Einheit muss zum Mandanten gehören (Vertrag kann auf andere Einheit umgezogen werden).
  const unit = await prisma.unit.findFirst({
    where: { id: r.data.unitId, tenantId: user.tenantId },
    select: { id: true },
  });
  if (!unit) return fail("Einheit nicht gefunden");
  await prisma.lease.updateMany({
    where: { id, tenantId: user.tenantId },
    data: { ...r.data, custom: pickCustom(Object.fromEntries(fd)) },
  });
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

// Personenzahl ab Datum während des Vertrags (#90); gleiches Datum überschreibt.
export async function addOccupancy(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const leaseId = String(fd.get("leaseId") ?? "");
  const validFrom = new Date(`${String(fd.get("validFrom") ?? "")}T00:00:00Z`);
  const persons = Number(fd.get("persons"));
  if (Number.isNaN(validFrom.getTime())) return fail("Datum fehlt");
  if (!Number.isInteger(persons) || persons < 0) return fail("Personenzahl muss 0 oder größer sein");
  if (!(await assertLease(user.tenantId, leaseId))) return fail("Vertrag nicht gefunden");
  await prisma.leaseOccupancy.upsert({
    where: { leaseId_validFrom: { leaseId, validFrom } },
    create: { tenantId: user.tenantId, leaseId, validFrom, persons },
    update: { persons },
  });
  return done();
}

export async function deleteOccupancy(fd: FormData): Promise<void> {
  const user = await requireWriter();
  await prisma.leaseOccupancy.deleteMany({ where: { id: String(fd.get("id") ?? ""), tenantId: user.tenantId } });
  revalidatePath("/", "layout");
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
  if (r.data.effectiveDate && r.data.endDate && r.data.endDate < r.data.effectiveDate) return fail("„Gültig bis“ liegt vor „Gültig ab“");
  await prisma.rentComponent.create({ data: { ...r.data, tenantId: user.tenantId } });
  return done();
}

/** Betrag ab Datum ändern (#87): alter Bestandteil endet am Vortag, neuer gilt ab dem Datum (0 = nur beenden). */
export async function adjustComponent(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const r = componentAdjustSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return fail(r.error.issues[0]?.message);
  const { id, amount, effectiveDate } = r.data;
  if (Number.isNaN(effectiveDate.getTime())) return fail("Ungültiges Datum");
  const c = await prisma.rentComponent.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!c) return fail("Bestandteil nicht gefunden");
  if (c.endDate) return fail("Bestandteil ist bereits beendet");
  if (c.effectiveDate && effectiveDate <= c.effectiveDate) return fail("Datum muss nach „Gültig ab“ des bisherigen Betrags liegen");
  const dayBefore = new Date(effectiveDate.getTime() - 86_400_000);
  await prisma.$transaction([
    prisma.rentComponent.update({ where: { id: c.id }, data: { endDate: dayBefore } }),
    ...(amount > 0
      ? [prisma.rentComponent.create({ data: { tenantId: c.tenantId, leaseId: c.leaseId, type: c.type, amount, note: c.note, effectiveDate } })]
      : []),
  ]);
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
  const { leaseId, accountId, ...rest } = r.data;
  const data = { ...rest, accountId: accountId || null };
  await prisma.deposit.upsert({
    where: { leaseId },
    create: { ...data, leaseId, tenantId: user.tenantId },
    update: data,
  });
  return done();
}

export async function deleteDeposit(fd: FormData): Promise<void> {
  const user = await requireWriter();
  await prisma.deposit.deleteMany({ where: { id: String(fd.get("id") ?? ""), tenantId: user.tenantId } });
  revalidatePath("/", "layout");
}
