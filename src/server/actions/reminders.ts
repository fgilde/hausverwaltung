"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import type { ActionState } from "@/lib/schemas";

const DAY = 864e5;

/**
 * Erzeugt Aufgaben aus fälligen Fristen: auslaufende Verträge (≤90 Tage) und
 * fällige/überfällige Wartungen (≤30 Tage). Dedupliziert über den Titel.
 */
export async function generateReminders(_p: ActionState, _fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const now = new Date();

  const [leases, maintenance, existing] = await Promise.all([
    prisma.lease.findMany({
      where: { tenantId: user.tenantId, endDate: { gte: now, lte: new Date(now.getTime() + 90 * DAY) } },
      include: { unit: { include: { building: { include: { property: true } } } } },
    }),
    prisma.maintenanceContract.findMany({
      where: { tenantId: user.tenantId, nextDue: { lte: new Date(now.getTime() + 30 * DAY) } },
      include: { property: { select: { name: true } } },
    }),
    prisma.task.findMany({ where: { tenantId: user.tenantId, done: false }, select: { title: true } }),
  ]);

  const seen = new Set(existing.map((t) => t.title));
  const toCreate: { title: string; dueDate: Date }[] = [];

  for (const l of leases) {
    if (!l.endDate) continue;
    const title = `Vertrag läuft aus: ${l.unit.building.property.name} · ${l.unit.label}`;
    if (!seen.has(title)) toCreate.push({ title, dueDate: l.endDate });
  }
  for (const m of maintenance) {
    const title = `Wartung fällig: ${m.title} (${m.property.name})`;
    if (!seen.has(title)) toCreate.push({ title, dueDate: m.nextDue });
  }

  if (toCreate.length > 0) {
    await prisma.task.createMany({
      data: toCreate.map((t) => ({ tenantId: user.tenantId, title: t.title, dueDate: t.dueDate })),
    });
    await audit(user, "CREATE", "Task", null, `${toCreate.length}× Fristen-Erinnerung`);
  }
  revalidatePath("/", "layout");
  return toCreate.length > 0
    ? { ok: true }
    : { error: "Keine neuen Fristen (bereits als Aufgabe erfasst oder keine anstehend)." };
}
