import { auth } from "@/auth";
import { actingTenantId } from "@/lib/acting-tenant";
import { roleAllows } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { simplePdf } from "@/lib/pdf";
import { wohnungsgeberDocument } from "@/lib/wohnungsgeber";

// Wohnungsgeberbestätigung (§ 19 BMG) als PDF zu einem Mietvertrag.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  if (!roleAllows(session.user.role, ["VERWALTER", "BUCHHALTUNG"])) return new Response("Forbidden", { status: 403 });

  const { id } = await params;
  const tenantId = await actingTenantId(session.user);
  const lease = await prisma.lease.findFirst({
    where: { id, tenantId },
    include: {
      unit: { include: { building: { include: { property: { include: { tenant: { select: { name: true } } } } } } } },
      renters: { include: { person: true } },
    },
  });
  if (!lease) return new Response("Not found", { status: 404 });

  const property = lease.unit.building.property;
  const address = `${property.street}, ${property.zip} ${property.city}`;
  const doc = wohnungsgeberDocument({
    landlordName: property.tenant.name,
    landlordAddress: address,
    tenantNames: lease.renters.map((r) => `${r.person.firstName} ${r.person.lastName}`),
    dwellingAddress: `${address} · ${property.name} · ${lease.unit.label}`,
    moveInDate: lease.startDate,
  });

  const pdf = simplePdf(doc.title, doc.lines);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Wohnungsgeberbestaetigung.pdf"`,
    },
  });
}
