"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { getTranslations } from "next-intl/server";
import { notifyByEmail, notifyUsers } from "@/lib/notify";
import { wallTime } from "@/lib/format";
import {
  contractorSchema,
  ticketCreateSchema,
  ticketUpdateSchema,
  ticketTimeSchema,
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
// Kontaktdaten usw. nachträglich ändern (#97)
export async function updateContractor(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const r = contractorSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return fail(r.error.issues[0]?.message);
  const res = await prisma.contractor.updateMany({
    where: { id: String(fd.get("id") ?? ""), tenantId: user.tenantId },
    data: { ...r.data, email: nn(r.data.email), phone: nn(r.data.phone) },
  });
  if (res.count === 0) return fail("Handwerker nicht gefunden");
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
  const created = await prisma.ticket.create({
    data: {
      tenantId: user.tenantId,
      title: r.data.title,
      description: r.data.description,
      category: r.data.category,
      priority: r.data.priority,
      propertyId: nn(r.data.propertyId),
      unitId: nn(r.data.unitId),
      contractorId: nn(r.data.contractorId),
      assigneeId: nn(r.data.assigneeId),
      dueDate: r.data.dueDate,
      reminderDate: r.data.reminderDate,
    },
  });
  await audit(user, "CREATE", "Ticket", created.id, r.data.title);
  return done();
}
export async function updateTicket(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const id = String(fd.get("id") ?? "");
  const r = ticketUpdateSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return fail(r.error.issues[0]?.message);
  const before = await prisma.ticket.findFirst({
    where: { id, tenantId: user.tenantId },
    select: { status: true, reporterId: true, visitAt: true, reporter: { select: { email: true } } },
  });
  if (!before) return fail("Ticket nicht gefunden");
  const visitAt = r.data.visitAt ?? null;
  await prisma.ticket.updateMany({
    where: { id, tenantId: user.tenantId },
    data: {
      title: r.data.title,
      description: r.data.description,
      category: r.data.category,
      priority: r.data.priority,
      status: r.data.status,
      propertyId: nn(r.data.propertyId),
      unitId: nn(r.data.unitId),
      contractorId: nn(r.data.contractorId),
      assigneeId: nn(r.data.assigneeId),
      dueDate: r.data.dueDate,
      reminderDate: r.data.reminderDate,
      visitAt,
    },
  });
  // Melder (Portal-Mieter) über Status, Nachricht und Handwerkertermin informieren (#100):
  // Verlauf im Portal, Glocke und, wenn eingeschaltet, E-Mail.
  const statusChanged = before.status !== r.data.status;
  const visitChanged = (before.visitAt?.getTime() ?? null) !== (visitAt?.getTime() ?? null);
  const message = r.data.reporterMessage;
  if (before.reporterId && (statusChanged || visitChanged || message)) {
    await prisma.ticketUpdate.create({
      data: {
        tenantId: user.tenantId,
        ticketId: id,
        status: statusChanged ? r.data.status : null,
        visitAt: visitChanged ? visitAt : null,
        message: message ?? null,
        author: user.name ?? null,
      },
    });
    const label = await getTranslations({ locale: "de", namespace: "ticketStatus" });
    const body = [
      statusChanged ? `Neuer Status: ${label(r.data.status)}` : "",
      visitChanged ? (visitAt ? `Handwerkertermin: ${wallTime(visitAt)}` : "Der Handwerkertermin wurde abgesagt.") : "",
      message ? `\n${message}` : "",
    ].filter(Boolean).join("\n");
    const n = {
      title: r.data.status === "ERLEDIGT" && statusChanged ? `Erledigt: ${r.data.title}` : `Ihre Meldung „${r.data.title}“ wurde aktualisiert`,
      body,
      link: "/portal",
    };
    await notifyUsers(user.tenantId, [before.reporterId], n);
    await notifyByEmail(user.tenantId, "TICKET_REPORTER", [before.reporter?.email ?? ""], n);
  }
  await audit(user, "UPDATE", "Ticket", id, r.data.title);
  return done();
}

// Zeiterfassung: Minuten auf ein Ticket addieren.
export async function addTicketTime(fd: FormData): Promise<void> {
  const user = await requireWriter();
  const r = ticketTimeSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return;
  await prisma.ticket.updateMany({
    where: { id: r.data.id, tenantId: user.tenantId },
    data: { timeSpentMin: { increment: r.data.minutes } },
  });
  revalidatePath("/", "layout");
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
// Vertragsdetails, Intervall, Fälligkeit nachträglich ändern (#97)
export async function updateMaintenance(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const r = maintenanceSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return fail(r.error.issues[0]?.message);
  const prop = await prisma.property.findFirst({ where: { id: r.data.propertyId, tenantId: user.tenantId }, select: { id: true } });
  if (!prop) return fail("Objekt nicht gefunden");
  const contractorId = nn(r.data.contractorId);
  if (contractorId && !(await prisma.contractor.findFirst({ where: { id: contractorId, tenantId: user.tenantId }, select: { id: true } })))
    return fail("Handwerker nicht gefunden");
  const res = await prisma.maintenanceContract.updateMany({
    where: { id: String(fd.get("id") ?? ""), tenantId: user.tenantId },
    data: { ...r.data, contractorId, note: nn(r.data.note) },
  });
  if (res.count === 0) return fail("Wartungsvertrag nicht gefunden");
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
