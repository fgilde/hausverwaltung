"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import type { ActionState } from "@/lib/schemas";

const issueSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().optional().transform((v) => (v ? v : undefined)),
});

// Schadensmeldung durch Portal-Nutzer (Mieter). Verknüpft mit eigener Einheit.
export async function reportIssue(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const r = issueSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Ungültige Eingabe" };

  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { personId: true } });
  if (!dbUser?.personId) return { error: "Kein Personenbezug" };

  // Einheit über Mietvertrag der Person ermitteln
  const renter = await prisma.renter.findFirst({
    where: { tenantId: user.tenantId, personId: dbUser.personId },
    include: { lease: { include: { unit: { include: { building: true } } } } },
    orderBy: { lease: { startDate: "desc" } },
  });

  await prisma.ticket.create({
    data: {
      tenantId: user.tenantId,
      title: r.data.title,
      description: r.data.description,
      status: "OFFEN",
      priority: "MITTEL",
      unitId: renter?.lease.unitId ?? null,
      propertyId: renter?.lease.unit.building.propertyId ?? null,
    },
  });
  revalidatePath("/portal");
  return { ok: true };
}
