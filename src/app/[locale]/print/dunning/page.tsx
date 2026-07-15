import { getTranslations, getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { money, date } from "@/lib/format";
import { PrintButton } from "@/components/print-button";

// Druckbare Mahnung / Zahlungserinnerung zu einer Sollstellung.
export default async function PrintDunningPage({
  searchParams,
}: {
  searchParams: Promise<{ chargeId?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const t = await getTranslations();
  const locale = await getLocale();

  const chargeId = sp.chargeId;
  if (!chargeId) notFound();

  const charge = await prisma.charge.findFirst({
    where: { id: chargeId, tenantId: user.tenantId },
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
  if (!charge || !charge.lease) notFound();

  const paid = charge.payments.reduce((a, p) => a + Number(p.amount), 0);
  const open = Number(charge.amount) - paid;
  const dun = charge.dunnings[0];
  const level = dun?.level ?? 1;
  const fee = dun ? Number(dun.fee) : 0;
  const total = open + fee;
  const property = charge.lease.unit.building.property;
  const tenantName = property.tenant.name;
  const renter = charge.lease.renters[0]?.person;
  const title = level >= 2 ? `${level}. ${t("print.dunningTitle")}` : t("print.reminderTitle");

  return (
    <div className="mx-auto max-w-2xl p-8 text-sm text-black">
      <div className="mb-8 flex items-start justify-between">
        <div className="text-xs text-neutral-500">
          {tenantName}
          <br />
          {property.street}, {property.zip} {property.city}
        </div>
        <PrintButton />
      </div>

      {renter && (
        <div className="mb-8">
          {renter.firstName} {renter.lastName}
          <br />
          {property.street}
          <br />
          {property.zip} {property.city}
        </div>
      )}

      <div className="mb-2 text-right text-neutral-500">{date(new Date(), locale)}</div>
      <h1 className="mb-4 text-lg font-bold">{title}</h1>

      <p className="mb-4">
        {t("print.dunningIntro", { unit: `${property.name} · ${charge.lease.unit.label}` })}
      </p>

      <table className="mb-4 w-full border-collapse">
        <tbody>
          <tr className="border-b border-neutral-300">
            <td className="py-1">{t(`chargeType.${charge.type}`)} · {date(charge.period, locale)}</td>
            <td className="py-1 text-right">{money(open, locale)}</td>
          </tr>
          {fee > 0 && (
            <tr className="border-b border-neutral-300">
              <td className="py-1">{t("print.dunningFee")}</td>
              <td className="py-1 text-right">{money(fee, locale)}</td>
            </tr>
          )}
          <tr className="border-t-2 border-black font-semibold">
            <td className="py-1">{t("print.dunningTotal")}</td>
            <td className="py-1 text-right">{money(total, locale)}</td>
          </tr>
        </tbody>
      </table>

      <p className="mb-8">{t("print.dunningRequest")}</p>
      <p>{t("print.regards")}</p>
      <p className="font-medium">{tenantName}</p>
    </div>
  );
}
