import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { actingTenantId } from "@/lib/acting-tenant";
import { roleAllows } from "@/lib/rbac";
import { toCsv, csvResponse } from "@/lib/csv";
import { computeAnlageV } from "@/server/tax";

// Anlage-V-Übersicht (#103) als CSV: Bereich; Position; Betrag.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  if (!roleAllows(session.user.role, ["VERWALTER", "BUCHHALTUNG"])) return new Response("Forbidden", { status: 403 });

  const q = new URL(req.url).searchParams;
  const year = Number(q.get("year")) || new Date().getFullYear() - 1;
  const data = await computeAnlageV(await actingTenantId(session.user), q.get("propertyId") ?? "", year);
  if (!data) return new Response("Not found", { status: 404 });

  const t = await getTranslations({ locale: "de" });
  const label = (key: string, l?: string) => (key === "cost" ? t(`costType.${l}`) : t(`tax.${key}`));
  const eur = (n: number) => n.toFixed(2).replace(".", ",");
  const rows = [
    ...data.income.map((r) => [t("tax.income"), label(r.key), eur(r.amount)]),
    [t("tax.income"), t("tax.incomeTotal"), eur(data.incomeTotal)],
    ...data.expenses.map((r) => [t("tax.expenses"), label(r.key, r.label), eur(r.amount)]),
    [t("tax.expenses"), t("tax.expenseTotal"), eur(data.expenseTotal)],
    ["", t("tax.surplus"), eur(data.surplus)],
  ];
  return csvResponse(`anlage-v-${year}.csv`, toCsv(["Bereich", "Position", "Betrag"], rows));
}
