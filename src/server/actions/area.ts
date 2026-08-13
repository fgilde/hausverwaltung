"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/rbac";
import { areaAllocationSchema, type ActionState } from "@/lib/schemas";

function fail(msg?: string): ActionState {
  return { error: msg ?? "Ungültige Eingabe" };
}
function done(): ActionState {
  revalidatePath("/", "layout");
  return { ok: true };
}

async function checkRefs(tenantId: string, propertyId: string, leaseId?: string, personId?: string) {
  const prop = await prisma.property.findFirst({ where: { id: propertyId, tenantId }, select: { id: true } });
  if (!prop) return "Objekt nicht gefunden";
  if (leaseId) {
    const lease = await prisma.lease.findFirst({ where: { id: leaseId, tenantId }, select: { id: true } });
    if (!lease) return "Vertrag nicht gefunden";
  }
  if (personId) {
    const person = await prisma.person.findFirst({ where: { id: personId, tenantId }, select: { id: true } });
    if (!person) return "Person nicht gefunden";
  }
  return null;
}

export async function createAreaAllocation(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const r = areaAllocationSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return fail(r.error.issues[0]?.message);
  const err = await checkRefs(user.tenantId, r.data.propertyId, r.data.leaseId, r.data.personId);
  if (err) return fail(err);
  await prisma.areaAllocation.create({ data: { ...r.data, tenantId: user.tenantId } });
  return done();
}

export async function updateAreaAllocation(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const id = String(fd.get("id") ?? "");
  const r = areaAllocationSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return fail(r.error.issues[0]?.message);
  const err = await checkRefs(user.tenantId, r.data.propertyId, r.data.leaseId, r.data.personId);
  if (err) return fail(err);
  const { propertyId, ...data } = r.data;
  void propertyId;
  await prisma.areaAllocation.updateMany({ where: { id, tenantId: user.tenantId }, data });
  return done();
}

export async function deleteAreaAllocation(fd: FormData): Promise<void> {
  const user = await requireWriter();
  await prisma.areaAllocation.deleteMany({
    where: { id: String(fd.get("id") ?? ""), tenantId: user.tenantId },
  });
  revalidatePath("/", "layout");
}
