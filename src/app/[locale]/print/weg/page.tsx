import { getTranslations, getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { money } from "@/lib/format";
import { allocate, type AllocationParticipant } from "@/lib/allocation";
import { PrintButton } from "@/components/print-button";

// Druckbare WEG-Jahresabrechnung inkl. Vermögensbericht.
export default async function PrintWegPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string; year?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const t = await getTranslations();
  const locale = await getLocale();
  const tenantId = user.tenantId;

  const propertyId = sp.propertyId;
  const year = Number(sp.year) || new Date().getFullYear();
  if (!propertyId) notFound();

  const property = await prisma.property.findFirst({
    where: { id: propertyId, tenantId, management: "WEG" },
    include: { tenant: { select: { name: true } } },
  });
  if (!property) notFound();

  const [owners, plan, reserves, costs] = await Promise.all([
    prisma.owner.findMany({ where: { tenantId, unit: { building: { propertyId } } }, include: { person: true, unit: true } }),
    prisma.economicPlan.findUnique({ where: { propertyId_year: { propertyId, year } } }),
    prisma.reserve.findMany({ where: { tenantId, propertyId }, include: { transactions: true } }),
    prisma.costEntry.findMany({ where: { tenantId, propertyId, year } }),
  ]);

  const weightOf = (o: (typeof owners)[number]) => ((o.unit.mea ?? 0) * o.share) / 1000;
  const parts: AllocationParticipant[] = owners.map((o) => ({ id: o.id, mea: weightOf(o) }));
  const planTotal = plan ? Number(plan.totalAmount) : 0;
  const actualTotal = costs.reduce((a, c) => a + Number(c.amount), 0);
  const hg = new Map((planTotal > 0 ? allocate(planTotal, "MEA", parts) : []).map((h) => [h.id, h.amount]));
  const ac = new Map((actualTotal > 0 ? allocate(actualTotal, "MEA", parts) : []).map((a) => [a.id, a.amount]));
  const reserveBalances = reserves.map((r) => ({ r, balance: r.transactions.reduce((a, tx) => a + Number(tx.amount), 0) }));
  const assetsTotal = reserveBalances.reduce((a, x) => a + x.balance, 0);

  return (
    <div className="mx-auto max-w-3xl p-8 text-sm text-black">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="text-xs text-neutral-500">{property.tenant.name}</div>
          <h1 className="text-xl font-bold">{t("weg.annual")} {year}</h1>
          <div className="text-neutral-600">{property.name} · {property.street}, {property.zip} {property.city}</div>
        </div>
        <PrintButton />
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="py-1">{t("weg.owners")}</th>
            <th className="py-1 text-right">{t("statements.allocated")}</th>
            <th className="py-1 text-right">{t("weg.yearlyHausgeld")}</th>
            <th className="py-1 text-right">{t("statements.balance")}</th>
          </tr>
        </thead>
        <tbody>
          {owners.map((o) => {
            const alloc = ac.get(o.id) ?? 0;
            const prepay = hg.get(o.id) ?? 0;
            const bal = Math.round((prepay - alloc) * 100) / 100;
            return (
              <tr key={o.id} className="border-b border-neutral-300">
                <td className="py-1">{o.person.firstName} {o.person.lastName}</td>
                <td className="py-1 text-right">{money(alloc, locale)}</td>
                <td className="py-1 text-right">{money(prepay, locale)}</td>
                <td className="py-1 text-right font-medium">{money(bal, locale)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-black font-semibold">
            <td className="py-1">{t("weg.actualTotal")}</td>
            <td className="py-1 text-right">{money(actualTotal, locale)}</td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>

      <h2 className="mt-8 mb-2 font-bold">{t("weg.assets")}</h2>
      <table className="w-full border-collapse">
        <tbody>
          {reserveBalances.map(({ r, balance }) => (
            <tr key={r.id} className="border-b border-neutral-300">
              <td className="py-1">{r.name}</td>
              <td className="py-1 text-right">{money(balance, locale)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-black font-semibold">
            <td className="py-1">{t("weg.assetsTotal")}</td>
            <td className="py-1 text-right">{money(assetsTotal, locale)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
