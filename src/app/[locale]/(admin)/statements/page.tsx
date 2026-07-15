import { getTranslations, getLocale } from "next-intl/server";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { money } from "@/lib/format";
import { buildStatement, type UnitInput, type CostInput } from "@/lib/allocation/statement";
import type { AllocationMethod } from "@/lib/allocation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CostDialog } from "@/components/cost-dialog";
import { DeleteButton } from "@/components/delete-button";
import { deleteCost } from "@/server/actions/costs";
import { Link } from "@/i18n/navigation";
import { Printer } from "lucide-react";

export default async function StatementsPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string; year?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const t = await getTranslations();
  const locale = await getLocale();
  const tenantId = user.tenantId;

  const properties = await prisma.property.findMany({
    where: { tenantId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  const propertyId = sp.propertyId || properties[0]?.id;
  const year = Number(sp.year) || new Date().getFullYear();

  let units: UnitInput[] = [];
  let costRows: { id: string; type: string; amount: number; method: string; umlagefaehig: boolean; note: string | null }[] = [];

  if (propertyId) {
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
                where: {
                  date: { gte: new Date(Date.UTC(year, 0, 1)), lte: new Date(Date.UTC(year, 11, 31)) },
                },
                orderBy: { value: "asc" },
              },
            },
          },
        },
      }),
      prisma.costEntry.findMany({ where: { tenantId, propertyId, year }, orderBy: { type: "asc" } }),
    ]);

    units = dbUnits.map((u) => {
      const lease = u.leases[0];
      const prepaymentMonthly = lease
        ? lease.components
            .filter((c) => c.type === "NEBENKOSTEN" || c.type === "HEIZKOSTEN")
            .reduce((a, c) => a + Number(c.amount), 0)
        : 0;
      // Jahresverbrauch je Wärme-/Warmwasserzähler = höchster minus niedrigster Stand im Jahr.
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

    costRows = costs.map((c) => ({
      id: c.id,
      type: c.type,
      amount: Number(c.amount),
      method: c.method,
      umlagefaehig: c.umlagefaehig,
      note: c.note,
    }));
  }

  const costInputs: CostInput[] = costRows.map((c) => ({
    id: c.id,
    amount: c.amount,
    method: c.method as AllocationMethod,
    umlagefaehig: c.umlagefaehig,
    heating: c.type === "HEIZUNG" || c.type === "WARMWASSER",
  }));
  const { lines, totalUmlage } = buildStatement(units, costInputs);
  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("statements.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("statements.subtitle")}</p>
        </div>
        {propertyId && costRows.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            render={<Link href={`/print/statement?propertyId=${propertyId}&year=${year}`} target="_blank" />}
          >
            <Printer className="size-4" />
            {t("print.printPdf")}
          </Button>
        )}
      </div>

      {/* Selektor */}
      <form className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">{t("statements.selectProperty")}</label>
          <select
            name="propertyId"
            defaultValue={propertyId}
            className="flex h-9 rounded-lg border border-input bg-transparent px-3 text-sm dark:bg-input/30"
          >
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">{t("statements.year")}</label>
          <select
            name="year"
            defaultValue={year}
            className="flex h-9 rounded-lg border border-input bg-transparent px-3 text-sm dark:bg-input/30"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" size="sm" variant="outline">
          {t("common.search")}
        </Button>
      </form>

      {/* Kosten */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            {t("statements.costs")} · {t("statements.total")}: {money(totalUmlage, locale)}
          </CardTitle>
          {propertyId && <CostDialog propertyId={propertyId} year={year} />}
        </CardHeader>
        <CardContent className="p-0">
          {costRows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">{t("statements.noCosts")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("fields.type")}</TableHead>
                  <TableHead>{t("statements.method")}</TableHead>
                  <TableHead>{t("statements.umlagefaehig")}</TableHead>
                  <TableHead className="text-right">{t("fields.amount")}</TableHead>
                  <TableHead className="w-16 text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costRows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      {t(`costType.${c.type}`)}
                      {c.note ? ` · ${c.note}` : ""}
                    </TableCell>
                    <TableCell>{t(`allocationMethod.${c.method}`)}</TableCell>
                    <TableCell>{c.umlagefaehig ? t("common.yes") : t("common.no")}</TableCell>
                    <TableCell className="text-right">{money(c.amount, locale)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <DeleteButton action={deleteCost} id={c.id} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Ergebnis */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("statements.result")}</CardTitle>
          <p className="text-xs text-muted-foreground">{t("statements.hint")}</p>
        </CardHeader>
        <CardContent className="p-0">
          {units.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">{t("statements.noUnits")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("leases.unit")}</TableHead>
                  <TableHead className="text-right">{t("statements.allocated")}</TableHead>
                  <TableHead className="text-right">{t("statements.prepayment")}</TableHead>
                  <TableHead className="text-right">{t("statements.balance")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l) => (
                  <TableRow key={l.unitId}>
                    <TableCell className="font-medium">{l.label}</TableCell>
                    <TableCell className="text-right">{money(l.allocated, locale)}</TableCell>
                    <TableCell className="text-right">{money(l.prepayment, locale)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={l.balance >= 0 ? "secondary" : "destructive"}>
                        {money(l.balance, locale)} · {l.balance >= 0 ? t("statements.credit") : t("statements.arrears")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
