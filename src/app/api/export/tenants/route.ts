import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET() {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const renters = await prisma.renter.findMany({
    where: { tenantId: session.user.tenantId },
    include: {
      person: true,
      lease: { include: { unit: { include: { building: { include: { property: true } } } }, components: { select: { amount: true } } } },
    },
  });

  const rows = renters.map((r) => {
    const warm = Number(r.lease.rentCold) + r.lease.components.reduce((a, c) => a + Number(c.amount), 0);
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
