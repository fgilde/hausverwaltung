import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET() {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const now = new Date();
  const units = await prisma.unit.findMany({
    where: { tenantId: session.user.tenantId },
    include: {
      building: { include: { property: { select: { name: true } } } },
      leases: { include: { renters: { include: { person: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });
  const rows = units.map((u) => {
    const active = u.leases.find((l) => l.startDate <= now && (!l.endDate || l.endDate >= now));
    return [
      u.building.property.name,
      u.building.name,
      u.label,
      u.type,
      Number(u.area),
      u.rooms == null ? "" : Number(u.rooms),
      u.mea ?? "",
      active ? "vermietet" : "leer",
      active ? active.renters.map((r) => `${r.person.firstName} ${r.person.lastName}`).join(", ") : "",
    ];
  });
  return csvResponse(
    "einheiten.csv",
    toCsv(["Objekt", "Gebaeude", "Bezeichnung", "Typ", "Flaeche", "Zimmer", "MEA", "Status", "Mieter"], rows),
  );
}
