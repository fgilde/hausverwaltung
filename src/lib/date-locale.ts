import "server-only";
import { cache } from "react";
import { auth } from "@/auth";
import { actingTenantId } from "@/lib/acting-tenant";
import { prisma } from "@/lib/prisma";

// Erlaubte Datumsformate (Mandanten-Einstellung, #18).
export const DATE_FORMATS = ["de-DE", "en-GB", "en-US", "iso"] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

// Effektives Datumsformat: Mandanten-Einstellung, sonst UI-Sprache (Altverhalten).
// Pro Request gecacht, damit nicht jede date()-Nutzung eine DB-Abfrage auslöst.
export const getDateLocale = cache(async (fallbackLocale = "de"): Promise<string> => {
  const session = await auth();
  if (!session?.user) return fallbackLocale;
  const tenantId = await actingTenantId(session.user);
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { dateFormat: true } });
  return tenant?.dateFormat || fallbackLocale;
});
