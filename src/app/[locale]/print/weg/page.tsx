import { getTranslations, getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/rbac";
import { money, decimal } from "@/lib/format";
import { computeWeg } from "@/server/weg";
import { PrintButton } from "@/components/print-button";

// Druckbare WEG-Jahresabrechnung inkl. Kostenaufstellung je Kreis
// (Gesamt-WEG / Untergemeinschaften, #42) und Vermögensbericht.
export default async function PrintWegPage({
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

  const weg = await computeWeg(user.tenantId, propertyId, year);
  const { property, owners, costs, scopes, subcommunities, reserves, actualTotal, unassigned } = weg;
  if (!property) notFound();

  const subName = new Map(subcommunities.map((s) => [s.id, s.name]));
  const scopeLabel = (id: string | null) => (id ? (subName.get(id) ?? "—") : t("weg.wholeCommunity"));
  const assetsTotal = reserves.reduce((a, x) => a + x.balance, 0);
  const th = "py-1 text-left";
  const thr = "py-1 text-right";

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

      <h2 className="mb-2 font-bold">{t("weg.costBreakdown")}</h2>
      <table className="mb-8 w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-black">
            <th className={th}>{t("weg.costItem")}</th>
            <th className={th}>{t("weg.scope")}</th>
            <th className={th}>{t("statements.method")}</th>
            <th className={thr}>{t("fields.amount")}</th>
          </tr>
        </thead>
        <tbody>
          {costs.map((c) => (
            <tr key={c.id} className="border-b border-neutral-300">
              <td className="py-1">{t(`costType.${c.type}`)}{c.note ? ` · ${c.note}` : ""}</td>
              <td className="py-1">{scopeLabel(c.subcommunityId)}</td>
              <td className="py-1">{t(`allocationMethod.${c.method}`)}</td>
              <td className="py-1 text-right">{money(Number(c.amount), locale)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          {subcommunities.length > 0 &&
            scopes.map((s) => (
              <tr key={s.id ?? "all"} className="text-neutral-600">
                <td className="py-0.5" colSpan={3}>
                  {scopeLabel(s.id)}
                  {s.id && ` (${t("weg.meaBasis")} ${decimal(s.meaSum, locale)})`}
                </td>
                <td className="py-0.5 text-right">{money(s.costTotal, locale)}</td>
              </tr>
            ))}
          <tr className="border-t-2 border-black font-semibold">
            <td className="py-1" colSpan={3}>{t("weg.actualTotal")}</td>
            <td className="py-1 text-right">{money(actualTotal, locale)}</td>
          </tr>
        </tfoot>
      </table>

      <h2 className="mb-2 font-bold">{t("weg.ownerStatement")}</h2>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-black">
            <th className={th}>{t("weg.owners")}</th>
            <th className={th}>{t("leases.unit")}</th>
            <th className={thr}>{t("statements.allocated")}</th>
            <th className={thr}>{t("weg.yearlyHausgeld")}</th>
            <th className={thr}>{t("statements.balance")}</th>
          </tr>
        </thead>
        <tbody>
          {owners.map((o) => (
            <tr key={o.id} className="border-b border-neutral-300">
              <td className="py-1">{o.person.firstName} {o.person.lastName}</td>
              <td className="py-1">
                {o.unit.label}
                {o.unit.subcommunityId && ` · ${subName.get(o.unit.subcommunityId)}`}
              </td>
              <td className="py-1 text-right">{money(o.line.allocated, locale)}</td>
              <td className="py-1 text-right">{money(o.line.hausgeld, locale)}</td>
              <td className="py-1 text-right font-medium">{money(o.line.balance, locale)}</td>
            </tr>
          ))}
          {unassigned.map((x) => (
            <tr key={x.unit.id} className="border-b border-neutral-300 text-neutral-500">
              <td className="py-1">{t("weg.noOwnerUnit")}</td>
              <td className="py-1">{x.unit.label}</td>
              <td className="py-1 text-right">{money(x.allocated, locale)}</td>
              <td className="py-1 text-right">{money(x.hausgeld, locale)}</td>
              <td />
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="mt-8 mb-2 font-bold">{t("weg.assets")}</h2>
      <table className="w-full border-collapse">
        <tbody>
          {reserves.map(({ r, balance }) => (
            <tr key={r.id} className="border-b border-neutral-300">
              <td className="py-1">
                {r.name}
                {subcommunities.length > 0 && ` (${scopeLabel(r.subcommunityId)})`}
              </td>
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
