import { auth } from "@/auth";
import { actingTenantId } from "@/lib/acting-tenant";
import { roleAllows } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { simplePdf } from "@/lib/pdf";
import { dunningDocument } from "@/lib/dunning";

// Mahnung / Zahlungserinnerung zu einer Sollstellung direkt als PDF (statt der
// HTML-Vorschauseite; umgeht auch das Darkmode-Darstellungsproblem). Spiegelt
// die zuletzt erstellte Mahnstufe wider.
export async function GET(_req: Request, { params }: { params: Promise<{ chargeId: string }> }) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  if (!roleAllows(session.user.role, ["VERWALTER", "BUCHHALTUNG"])) return new Response("Forbidden", { status: 403 });

  const { chargeId } = await params;
  const tenantId = await actingTenantId(session.user);
  const charge = await prisma.charge.findFirst({
    where: { id: chargeId, tenantId },
    include: {
      payments: { select: { amount: true } },
      dunnings: { orderBy: { level: "desc" }, take: 1 },
      lease: {
        include: {
          unit: { include: { building: { include: { property: { include: { tenant: { select: { name: true } } } } } } } },
          renters: { include: { person: true } },
        },
      },
    },
  });
  if (!charge || !charge.lease) return new Response("Not found", { status: 404 });

  const paid = charge.payments.reduce((a, p) => a + Number(p.amount), 0);
  const open = Number(charge.amount) - paid;
  const dun = charge.dunnings[0];
  const property = charge.lease.unit.building.property;
  const renter = charge.lease.renters[0]?.person;

  const doc = dunningDocument({
    level: dun?.level ?? 1,
    propertyName: property.name,
    unitLabel: charge.lease.unit.label,
    renterName: renter ? `${renter.firstName} ${renter.lastName}` : "",
    tenantName: property.tenant.name,
    chargeTypeLabel: charge.type,
    period: charge.period,
    dueDate: charge.dueDate,
    open,
    fee: dun ? Number(dun.fee) : 0,
  });

  const pdf = simplePdf(doc.title, doc.lines);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${doc.title.replace(/[^\x20-\x7e]/g, "_")}.pdf"`,
    },
  });
}
