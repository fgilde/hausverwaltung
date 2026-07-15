import { getTranslations, getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/rbac";
import { money } from "@/lib/format";
import { computeStatement } from "@/server/statements";
import { PrintButton } from "@/components/print-button";

// Druckbare Betriebskostenabrechnung (eigenes, minimales Layout).
export default async function PrintStatementPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string; year?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const t = await getTranslations();
  const locale = await getLocale();

  const propertyId = sp.propertyId;
  const year = Number(sp.year) || new Date().getFullYear();
  if (!propertyId) notFound();

  const st = await computeStatement(user.tenantId, propertyId, year);
  if (!st.property) notFound();

  return (
    <div className="mx-auto max-w-3xl p-8 text-sm text-black">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="text-xs text-neutral-500">{st.property.tenantName}</div>
          <h1 className="text-xl font-bold">{t("statements.title")} {year}</h1>
          <div className="text-neutral-600">
            {st.property.name} · {st.property.street}, {st.property.zip} {st.property.city}
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
          {st.units.map((l) => (
            <tr key={l.id} className="border-b border-neutral-300">
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
            <td className="py-1 text-right">{money(st.totalUmlage, locale)}</td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>

      <p className="mt-8 text-xs text-neutral-500">{t("print.heatingNote")}</p>
    </div>
  );
}
