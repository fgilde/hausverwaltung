import "server-only";
import { cache } from "react";
import type { Currency } from "@/lib/currency";
import { prisma } from "@/lib/prisma";

export const getTenantCurrency = cache(async (tenantId: string): Promise<Currency> => {
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { currency: true },
  });
  return tenant.currency;
});
