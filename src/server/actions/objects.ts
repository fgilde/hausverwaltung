"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/rbac";
import {
  propertySchema,
  buildingSchema,
  unitSchema,
  meterSchema,
  readingSchema,
  type ActionState,
} from "@/lib/schemas";

function fail(msg?: string): ActionState {
  return { error: msg ?? "Ungültige Eingabe" };
}
function done(): ActionState {
  revalidatePath("/", "layout");
  return { ok: true };
}

// --- Property ---
export async function createProperty(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const r = propertySchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return fail(r.error.issues[0]?.message);
  await prisma.property.create({ data: { ...r.data, tenantId: user.tenantId } });
  return done();
}

export async function updateProperty(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const id = String(fd.get("id") ?? "");
  const r = propertySchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return fail(r.error.issues[0]?.message);
  await prisma.property.updateMany({ where: { id, tenantId: user.tenantId }, data: r.data });
  return done();
}

export async function deleteProperty(fd: FormData): Promise<void> {
  const user = await requireWriter();
  await prisma.property.deleteMany({
    where: { id: String(fd.get("id") ?? ""), tenantId: user.tenantId },
  });
  revalidatePath("/", "layout");
}

// --- Building ---
export async function createBuilding(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const r = buildingSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return fail(r.error.issues[0]?.message);
  // Property muss zum Mandanten gehören.
  const prop = await prisma.property.findFirst({
    where: { id: r.data.propertyId, tenantId: user.tenantId },
    select: { id: true },
  });
  if (!prop) return fail("Objekt nicht gefunden");
  await prisma.building.create({ data: { ...r.data, tenantId: user.tenantId } });
  return done();
}

export async function updateBuilding(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const id = String(fd.get("id") ?? "");
  const r = buildingSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return fail(r.error.issues[0]?.message);
  await prisma.building.updateMany({
    where: { id, tenantId: user.tenantId },
    data: { name: r.data.name },
  });
  return done();
}

export async function deleteBuilding(fd: FormData): Promise<void> {
  const user = await requireWriter();
  await prisma.building.deleteMany({
    where: { id: String(fd.get("id") ?? ""), tenantId: user.tenantId },
  });
  revalidatePath("/", "layout");
}

// --- Unit ---
export async function createUnit(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const r = unitSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return fail(r.error.issues[0]?.message);
  const b = await prisma.building.findFirst({
    where: { id: r.data.buildingId, tenantId: user.tenantId },
    select: { id: true },
  });
  if (!b) return fail("Gebäude nicht gefunden");
  await prisma.unit.create({ data: { ...r.data, tenantId: user.tenantId } });
  return done();
}

export async function updateUnit(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const id = String(fd.get("id") ?? "");
  const r = unitSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return fail(r.error.issues[0]?.message);
  const { buildingId, ...data } = r.data;
  void buildingId;
  await prisma.unit.updateMany({ where: { id, tenantId: user.tenantId }, data });
  return done();
}

export async function deleteUnit(fd: FormData): Promise<void> {
  const user = await requireWriter();
  await prisma.unit.deleteMany({
    where: { id: String(fd.get("id") ?? ""), tenantId: user.tenantId },
  });
  revalidatePath("/", "layout");
}

// --- Meter ---
export async function createMeter(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const r = meterSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return fail(r.error.issues[0]?.message);
  const u = await prisma.unit.findFirst({
    where: { id: r.data.unitId, tenantId: user.tenantId },
    select: { id: true },
  });
  if (!u) return fail("Einheit nicht gefunden");
  await prisma.meter.create({ data: { ...r.data, tenantId: user.tenantId } });
  return done();
}

export async function deleteMeter(fd: FormData): Promise<void> {
  const user = await requireWriter();
  await prisma.meter.deleteMany({
    where: { id: String(fd.get("id") ?? ""), tenantId: user.tenantId },
  });
  revalidatePath("/", "layout");
}

// --- MeterReading ---
export async function createReading(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const r = readingSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return fail(r.error.issues[0]?.message);
  const m = await prisma.meter.findFirst({
    where: { id: r.data.meterId, tenantId: user.tenantId },
    select: { id: true },
  });
  if (!m) return fail("Zähler nicht gefunden");
  await prisma.meterReading.create({ data: { ...r.data, tenantId: user.tenantId } });
  return done();
}

export async function deleteReading(fd: FormData): Promise<void> {
  const user = await requireWriter();
  await prisma.meterReading.deleteMany({
    where: { id: String(fd.get("id") ?? ""), tenantId: user.tenantId },
  });
  revalidatePath("/", "layout");
}
