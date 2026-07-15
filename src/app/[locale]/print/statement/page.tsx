import { getTranslations, getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { money } from "@/lib/format";
import { buildStatement, type UnitInput, type CostInput } from "@/lib/allocation/statement";
import type { AllocationMethod } from "@/lib/allocation";
import { PrintButton } from "@/components/print-button";

// Druckbare Betriebskostenabrechnung. Eigenes, minimales Layout (kein Sidebar-
// Chrome), für "Als PDF speichern" über den Browser-Druckdialog.
export default async function PrintStatementPage({
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
    where: { id: propertyId, tenantId },
    include: { tenant: { select: { name: true } } },
  });
  if (!property) notFound();

  const [dbUnits, costs] = await Promise.all([
    prisma.unit.findMany({
      where: { tenantId, building: { propertyId } },
      include: {
        leases: {
          where: {
            startDate: { lte: new Date(Date.UTC(year, 11, 31)) },
            OR: [{ endDate: null }, { endDate: { gte: new Date(Date.UTC(year, 0, 1)) } }],
          },
          include: { components: true },
          orderBy: { startDate: "desc" },
          take: 1,
        },
        meters: {
          where: { type: { in: ["WAERME", "WASSER_WARM"] } },
          include: {
            readings: {
              where: { date: { gte: new Date(Date.UTC(year, 0, 1)), lte: new Date(Date.UTC(year, 11, 31)) } },
              orderBy: { value: "asc" },
            },
          },
        },
      },
    }),
    prisma.costEntry.findMany({ where: { tenantId, propertyId, year }, orderBy: { type: "asc" } }),
  ]);

  const units: UnitInput[] = dbUnits.map((u) => {
    const lease = u.leases[0];
    const prepaymentMonthly = lease
      ? lease.components.filter((c) => c.type === "NEBENKOSTEN" || c.type === "HEIZKOSTEN").reduce((a, c) => a + Number(c.amount), 0)
      : 0;
    const consumption = u.meters.reduce((sum, m) => {
      const vals = m.readings.map((r) => Number(r.value));
      return sum + (vals.length >= 2 ? vals[vals.length - 1] - vals[0] : 0);
    }, 0);
    return {
      id: u.id,
      label: u.label,
      area: Number(u.area),
      persons: lease?.personCount ?? 1,
      mea: u.mea ?? undefined,
      prepayment: prepaymentMonthly * 12,
      consumption,
    };
  });

  const costInputs: CostInput[] = costs.map((c) => ({
    id: c.id,
    amount: Number(c.amount),
    method: c.method as AllocationMethod,
    umlagefaehig: c.umlagefaehig,
    heating: c.type === "HEIZUNG" || c.type === "WARMWASSER",
  }));
  const { lines, totalUmlage } = buildStatement(units, costInputs);

  return (
    <div className="mx-auto max-w-3xl p-8 text-sm text-black">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="text-xs text-neutral-500">{property.tenant.name}</div>
          <h1 className="text-xl font-bold">{t("statements.title")} {year}</h1>
          <div className="text-neutral-600">
            {property.name} · {property.street}, {property.zip} {property.city}
          </div>
        </div>
        <PrintButton />
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="py-1">{t("leases.unit")}</th>
            <th className="py-1 text-right">{t("statements.allocated")}</th>
            <th className="py-1 text-right">{t("statements.prepayment")}</th>
            <th className="py-1 text-right">{t("statements.balance")}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.unitId} className="border-b border-neutral-300">
              <td className="py-1">{l.label}</td>
              <td className="py-1 text-right">{money(l.allocated, locale)}</td>
              <td className="py-1 text-right">{money(l.prepayment, locale)}</td>
              <td className="py-1 text-right font-medium">
                {money(l.balance, locale)} {l.balance >= 0 ? t("statements.credit") : t("statements.arrears")}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-black font-semibold">
            <td className="py-1">{t("statements.total")}</td>
            <td className="py-1 text-right">{money(totalUmlage, locale)}</td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>

      <p className="mt-8 text-xs text-neutral-500">
        {t("print.heatingNote")}
      </p>
    </div>
  );
}
