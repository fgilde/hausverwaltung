import "server-only";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { simplePdf } from "@/lib/pdf";
import { dunningDocument } from "@/lib/dunning";
import { tenantContact } from "@/server/letters";

/**
 * Mahnung / Zahlungserinnerung zu einer Sollstellung (zuletzt erstellte Stufe):
 * Text + PDF, geteilt von PDF-Route, E-Mail- und Briefversand (#78).
 * null, wenn die Sollstellung nicht zum Mandanten gehört oder keinen Vertrag hat.
 */
export async function dunningFor(tenantId: string, chargeId: string) {
  const charge = await prisma.charge.findFirst({
    where: { id: chargeId, tenantId },
    include: {
      payments: { select: { amount: true } },
      dunnings: { orderBy: { level: "desc" }, take: 1 },
      lease: {
        include: {
          unit: { include: { building: { include: { property: { include: { tenant: true } } } } } },
          renters: { include: { person: true } },
        },
      },
    },
  });
  if (!charge?.lease) return null;
  const lease = charge.lease;
  const paid = charge.payments.reduce((a, p) => a + Number(p.amount), 0);
  const open = Number(charge.amount) - paid;
  const dun = charge.dunnings[0];
  const fee = dun ? Number(dun.fee) : 0;
  const property = lease.unit.building.property;
  const renter = lease.renters[0]?.person ?? null;
  const input = {
    level: dun?.level ?? 1,
    propertyName: property.name,
    unitLabel: lease.unit.label,
    renterName: renter ? `${renter.firstName} ${renter.lastName}` : "",
    tenantName: property.tenant.name,
    currency: property.tenant.currency,
    tenantContact: tenantContact(property.tenant),
    // Mahnungen sind deutschsprachig, daher das deutsche Label der Kostenart
    chargeTypeLabel: (await getTranslations({ locale: "de", namespace: "chargeType" }))(charge.type),
    period: charge.period,
    dueDate: charge.dueDate,
    open,
    fee,
  };
  const doc = dunningDocument(input);
  return { charge, lease, property, renter, input, doc, total: open + fee, pdf: () => simplePdf(doc.title, doc.lines) };
}
