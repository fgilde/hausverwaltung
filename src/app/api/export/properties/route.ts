import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET() {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const props = await prisma.property.findMany({
    where: { tenantId: session.user.tenantId },
    include: { buildings: { include: { _count: { select: { units: true } } } } },
    orderBy: { name: "asc" },
  });

  const rows = props.map((p) => [
    p.name,
    p.type,
    p.management,
    p.street,
    p.zip,
    p.city,
    p.buildings.reduce((a, b) => a + b._count.units, 0),
  ]);
  return csvResponse("objekte.csv", toCsv(["Name", "Typ", "Verwaltung", "Strasse", "PLZ", "Ort", "Einheiten"], rows));
}
