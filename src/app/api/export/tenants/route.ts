import { auth } from "@/auth";
import { actingTenantId } from "@/lib/acting-tenant";
import { prisma } from "@/lib/prisma";
import { toCsv, csvResponse } from "@/lib/csv";
import { recurringComponentAmountAt } from "@/lib/rent-components";

export async function GET() {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const renters = await prisma.renter.findMany({
    where: { tenantId: (await actingTenantId(session.user)) },
    include: {
      person: true,
      lease: { include: { unit: { include: { building: { include: { property: true } } } }, components: { select: { type: true, amount: true, effectiveDate: true } } } },
    },
  });

  const rows = renters.map((r) => {
    const warm = Number(r.lease.rentCold) + recurringComponentAmountAt(r.lease.components, new Date());
    return [
      `${r.person.firstName} ${r.person.lastName}`,
      r.person.email ?? "",
      r.person.phone ?? "",
      r.lease.unit.building.property.name,
      r.lease.unit.label,
      warm.toFixed(2).replace(".", ","),
      r.lease.startDate.toISOString().slice(0, 10),
    ];
  });
  return csvResponse("mieter.csv", toCsv(["Name", "E-Mail", "Telefon", "Objekt", "Einheit", "Warmmiete", "Beginn"], rows));
}
