"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/rbac";
import { costEntrySchema, type ActionState } from "@/lib/schemas";
import { subcommunityValid } from "@/server/weg";
import type { UnitType } from "@prisma/client";

const UNIT_TYPES: UnitType[] = ["WOHNUNG", "ZIMMER", "GEWERBE", "STELLPLATZ", "KELLER", "SONSTIGES"];

// Checkboxen kommen mehrfach unter einem Namen, Object.fromEntries behält nur einen (#105).
const unitTypesOf = (fd: FormData) =>
  fd.getAll("unitTypes").map(String).filter((v): v is UnitType => (UNIT_TYPES as string[]).includes(v));

async function parseCost(fd: FormData, tenantId: string) {
  const r = costEntrySchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Ungültige Eingabe" };
  const prop = await prisma.property.findFirst({
    where: { id: r.data.propertyId, tenantId },
    select: { id: true },
  });
  if (!prop) return { error: "Objekt nicht gefunden" };
  if (!(await subcommunityValid(tenantId, r.data.propertyId, r.data.subcommunityId))) {
    return { error: "Untergemeinschaft nicht gefunden" };
  }
  return { data: { ...r.data, unitTypes: unitTypesOf(fd) } };
}

export async function createCost(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const r = await parseCost(fd, user.tenantId);
  if (!r.data) return { error: r.error };
  await prisma.costEntry.create({ data: { ...r.data, tenantId: user.tenantId } });
  revalidatePath("/", "layout");
  return { ok: true };
}

// Bezeichnung, Betrag, Schlüssel usw. nachträglich korrigieren (#97).
export async function updateCost(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const id = String(fd.get("id") ?? "");
  const r = await parseCost(fd, user.tenantId);
  if (!r.data) return { error: r.error };
  const { propertyId, year, ...data } = r.data;
  const res = await prisma.costEntry.updateMany({
    where: { id, tenantId: user.tenantId, propertyId, year },
    data: { ...data, subcommunityId: data.subcommunityId ?? null, consumptionSharePct: data.consumptionSharePct ?? null, note: data.note ?? null },
  });
  if (res.count === 0) return { error: "Kostenposition nicht gefunden" };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteCost(fd: FormData): Promise<void> {
  const user = await requireWriter();
  await prisma.costEntry.deleteMany({ where: { id: String(fd.get("id") ?? ""), tenantId: user.tenantId } });
  revalidatePath("/", "layout");
}
