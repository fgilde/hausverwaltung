"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/rbac";
import {
  meetingCreateSchema,
  meetingUpdateSchema,
  agendaSchema,
  resolutionSchema,
  type ActionState,
} from "@/lib/schemas";

function fail(msg?: string): ActionState {
  return { error: msg ?? "Ungültige Eingabe" };
}
function done(): ActionState {
  revalidatePath("/", "layout");
  return { ok: true };
}

// --- Meeting ---
export async function createMeeting(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const r = meetingCreateSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return fail(r.error.issues[0]?.message);
  const prop = await prisma.property.findFirst({ where: { id: r.data.propertyId, tenantId: user.tenantId }, select: { id: true } });
  if (!prop) return fail("Objekt nicht gefunden");
  await prisma.meeting.create({ data: { ...r.data, tenantId: user.tenantId } });
  return done();
}

export async function updateMeeting(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const id = String(fd.get("id") ?? "");
  const r = meetingUpdateSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return fail(r.error.issues[0]?.message);
  await prisma.meeting.updateMany({ where: { id, tenantId: user.tenantId }, data: r.data });
  return done();
}

export async function deleteMeeting(fd: FormData): Promise<void> {
  const user = await requireWriter();
  await prisma.meeting.deleteMany({ where: { id: String(fd.get("id") ?? ""), tenantId: user.tenantId } });
  revalidatePath("/", "layout");
}

// --- AgendaItem (Position automatisch) ---
export async function addAgenda(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const r = agendaSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return fail(r.error.issues[0]?.message);
  const meeting = await prisma.meeting.findFirst({ where: { id: r.data.meetingId, tenantId: user.tenantId }, select: { id: true } });
  if (!meeting) return fail("Versammlung nicht gefunden");
  const count = await prisma.agendaItem.count({ where: { meetingId: r.data.meetingId } });
  await prisma.agendaItem.create({ data: { ...r.data, tenantId: user.tenantId, position: count + 1 } });
  return done();
}

export async function deleteAgenda(fd: FormData): Promise<void> {
  const user = await requireWriter();
  await prisma.agendaItem.deleteMany({ where: { id: String(fd.get("id") ?? ""), tenantId: user.tenantId } });
  revalidatePath("/", "layout");
}

// --- Resolution (Beschlussnummer fortlaufend je Objekt) ---
export async function createResolution(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const r = resolutionSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return fail(r.error.issues[0]?.message);
  const prop = await prisma.property.findFirst({ where: { id: r.data.propertyId, tenantId: user.tenantId }, select: { id: true } });
  if (!prop) return fail("Objekt nicht gefunden");
  const last = await prisma.resolution.findFirst({
    where: { propertyId: r.data.propertyId, tenantId: user.tenantId },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  await prisma.resolution.create({
    data: { ...r.data, tenantId: user.tenantId, number: (last?.number ?? 0) + 1 },
  });
  return done();
}

export async function deleteResolution(fd: FormData): Promise<void> {
  const user = await requireWriter();
  await prisma.resolution.deleteMany({ where: { id: String(fd.get("id") ?? ""), tenantId: user.tenantId } });
  revalidatePath("/", "layout");
}
