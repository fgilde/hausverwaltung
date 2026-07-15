"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/rbac";
import {
  contractorSchema,
  ticketCreateSchema,
  ticketUpdateSchema,
  maintenanceSchema,
  type ActionState,
} from "@/lib/schemas";

function fail(msg?: string): ActionState {
  return { error: msg ?? "Ungültige Eingabe" };
}
function done(): ActionState {
  revalidatePath("/", "layout");
  return { ok: true };
}
// leere Strings aus optionalen Selects zu null
function nn(v: string | undefined) {
  return v ? v : null;
}

// --- Contractor ---
export async function createContractor(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const r = contractorSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return fail(r.error.issues[0]?.message);
  await prisma.contractor.create({ data: { ...r.data, tenantId: user.tenantId } });
  return done();
}
export async function deleteContractor(fd: FormData): Promise<void> {
  const user = await requireWriter();
  await prisma.contractor.deleteMany({ where: { id: String(fd.get("id") ?? ""), tenantId: user.tenantId } });
  revalidatePath("/", "layout");
}

// --- Ticket ---
export async function createTicket(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const r = ticketCreateSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return fail(r.error.issues[0]?.message);
  await prisma.ticket.create({
    data: {
      tenantId: user.tenantId,
      title: r.data.title,
      description: r.data.description,
      priority: r.data.priority,
      propertyId: nn(r.data.propertyId),
      unitId: nn(r.data.unitId),
      contractorId: nn(r.data.contractorId),
    },
  });
  return done();
}
export async function updateTicket(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const id = String(fd.get("id") ?? "");
  const r = ticketUpdateSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return fail(r.error.issues[0]?.message);
  await prisma.ticket.updateMany({
    where: { id, tenantId: user.tenantId },
    data: {
      title: r.data.title,
      description: r.data.description,
      priority: r.data.priority,
      status: r.data.status,
      propertyId: nn(r.data.propertyId),
      unitId: nn(r.data.unitId),
      contractorId: nn(r.data.contractorId),
    },
  });
  return done();
}
export async function deleteTicket(fd: FormData): Promise<void> {
  const user = await requireWriter();
  await prisma.ticket.deleteMany({ where: { id: String(fd.get("id") ?? ""), tenantId: user.tenantId } });
  revalidatePath("/", "layout");
}

// --- MaintenanceContract ---
export async function createMaintenance(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const r = maintenanceSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return fail(r.error.issues[0]?.message);
  const prop = await prisma.property.findFirst({ where: { id: r.data.propertyId, tenantId: user.tenantId }, select: { id: true } });
  if (!prop) return fail("Objekt nicht gefunden");
  await prisma.maintenanceContract.create({
    data: { ...r.data, tenantId: user.tenantId, contractorId: nn(r.data.contractorId) },
  });
  return done();
}
export async function deleteMaintenance(fd: FormData): Promise<void> {
  const user = await requireWriter();
  await prisma.maintenanceContract.deleteMany({ where: { id: String(fd.get("id") ?? ""), tenantId: user.tenantId } });
  revalidatePath("/", "layout");
}
// nächsten Fälligkeitstermin um Intervall vorrücken
export async function advanceMaintenance(fd: FormData): Promise<void> {
  const user = await requireWriter();
  const id = String(fd.get("id") ?? "");
  const mc = await prisma.maintenanceContract.findFirst({ where: { id, tenantId: user.tenantId } });
  if (mc) {
    const next = new Date(mc.nextDue);
    next.setMonth(next.getMonth() + mc.intervalMonths);
    await prisma.maintenanceContract.update({ where: { id: mc.id }, data: { nextDue: next } });
  }
  revalidatePath("/", "layout");
}
