import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET() {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const charges = await prisma.charge.findMany({
    where: { tenantId: session.user.tenantId },
    include: {
      payments: { select: { amount: true } },
      lease: { include: { unit: { include: { building: { include: { property: true } } } } } },
    },
    orderBy: { dueDate: "asc" },
  });

  const rows = charges
    .map((c) => {
      const open = Number(c.amount) - c.payments.reduce((a, p) => a + Number(p.amount), 0);
      return { c, open };
    })
    .filter((x) => x.open > 0.001)
    .map(({ c, open }) => [
      c.lease ? `${c.lease.unit.building.property.name} · ${c.lease.unit.label}` : "",
      c.type,
      c.period.toISOString().slice(0, 10),
      c.dueDate.toISOString().slice(0, 10),
      Number(c.amount).toFixed(2).replace(".", ","),
      open.toFixed(2).replace(".", ","),
    ]);
  return csvResponse("offene-posten.csv", toCsv(["Einheit", "Art", "Zeitraum", "Faellig", "Betrag", "Offen"], rows));
}
