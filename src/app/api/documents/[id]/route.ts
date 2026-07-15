import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { readFile } from "@/lib/storage";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const tenantId = session.user.tenantId;
  const role = session.user.role;

  // Portal-Rollen dürfen nur Dokumente ihrer eigenen Objekte laden.
  let where: import("@prisma/client").Prisma.DocumentWhereInput = { id, tenantId };
  if (role === "MIETER" || role === "EIGENTUEMER" || role === "HANDWERKER") {
    const u = await prisma.user.findUnique({ where: { id: session.user.id }, select: { personId: true } });
    const personId = u?.personId ?? "__none__";
    const [renters, owners] = await Promise.all([
      prisma.renter.findMany({
        where: { tenantId, personId },
        select: { lease: { select: { unit: { select: { building: { select: { propertyId: true } } } } } } },
      }),
      prisma.owner.findMany({
        where: { tenantId, personId },
        select: { unit: { select: { building: { select: { propertyId: true } } } } },
      }),
    ]);
    const propIds = [
      ...renters.map((r) => r.lease.unit.building.propertyId),
      ...owners.map((o) => o.unit.building.propertyId),
    ];
    where = { id, tenantId, propertyId: { in: propIds.length ? propIds : ["__none__"] } };
  }

  const doc = await prisma.document.findFirst({ where });
  if (!doc) return new Response("Not found", { status: 404 });

  const buf = await readFile(doc.storageKey);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": doc.mime,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(doc.name)}"`,
    },
  });
}
