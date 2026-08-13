"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { needsSetup } from "@/lib/setup";
import { ensureDefaultAccounts } from "@/lib/accounts";
import { setupSchema, type ActionState } from "@/lib/schemas";

// Ersteinrichtung: legt ersten Mandanten + Administrator an. Nur bei leerem System.
export async function setupSystem(_p: ActionState, fd: FormData): Promise<ActionState> {
  if (!(await needsSetup())) return { error: "System ist bereits eingerichtet." };

  const r = setupSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Ungültige Eingabe" };
  const { tenantName, name, email, password, locale, brandColor, propertyName, propertyStreet, propertyZip, propertyCity } = r.data;

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { error: "E-Mail bereits vergeben." };

  const tenant = await prisma.tenant.create({
    data: {
      name: tenantName,
      brandColor: brandColor || null,
      users: {
        create: {
          email,
          name,
          passwordHash: await bcrypt.hash(password, 10),
          role: "ADMIN",
          locale,
        },
      },
    },
  });

  // Standard-Kontenrahmen anlegen
  await ensureDefaultAccounts(prisma, tenant.id);

  // Optionales erstes Objekt
  if (propertyName) {
    await prisma.property.create({
      data: {
        tenantId: tenant.id,
        name: propertyName,
        street: propertyStreet || "-",
        zip: propertyZip || "-",
        city: propertyCity || "-",
      },
    });
  }

  redirect("/login");
}
