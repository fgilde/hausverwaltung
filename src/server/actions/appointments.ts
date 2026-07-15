"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { appointmentSchema, type ActionState } from "@/lib/schemas";

export async function createAppointment(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const r = appointmentSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Ungültige Eingabe" };

  // Objekt-Zugehörigkeit prüfen (Mandant).
  if (r.data.propertyId) {
    const prop = await prisma.property.findFirst({
      where: { id: r.data.propertyId, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!prop) return { error: "Objekt nicht gefunden" };
  }

  const appt = await prisma.appointment.create({
    data: { ...r.data, tenantId: user.tenantId },
  });
  await audit(user, "CREATE", "Appointment", appt.id, r.data.title);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteAppointment(fd: FormData): Promise<void> {
  const user = await requireWriter();
  const id = String(fd.get("id") ?? "");
  const res = await prisma.appointment.deleteMany({ where: { id, tenantId: user.tenantId } });
  if (res.count > 0) await audit(user, "DELETE", "Appointment", id);
  revalidatePath("/", "layout");
}
