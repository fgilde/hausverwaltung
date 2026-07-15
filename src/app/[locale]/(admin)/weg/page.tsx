import { getTranslations, getLocale } from "next-intl/server";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { money } from "@/lib/format";
import { allocate, type AllocationParticipant } from "@/lib/allocation";
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
import { OwnerDialog, PlanDialog, ReserveDialog, ReserveTxDialog } from "@/components/weg-dialogs";
import { DeleteButton } from "@/components/delete-button";
import { deleteOwner, deleteReserve, deleteReserveTx } from "@/server/actions/weg";
import { Link } from "@/i18n/navigation";
import { Printer } from "lucide-react";

export default async function WegPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string; year?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const t = await getTranslations();
  const locale = await getLocale();
  const tenantId = user.tenantId;

  const wegProps = await prisma.property.findMany({
    where: { tenantId, management: "WEG" },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  const propertyId = sp.propertyId || wegProps[0]?.id;
  const year = Number(sp.year) || new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

  if (!propertyId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("weg.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("weg.subtitle")}</p>
        </div>
        <p className="text-sm text-muted-foreground">{t("weg.noWeg")}</p>
      </div>
    );
  }

  const [owners, units, persons, plan, reserves, costs] = await Promise.all([
    prisma.owner.findMany({
      where: { tenantId, unit: { building: { propertyId } } },
      include: { person: true, unit: true },
    }),
    prisma.unit.findMany({ where: { tenantId, building: { propertyId } }, select: { id: true, label: true } }),
    prisma.person.findMany({ where: { tenantId }, orderBy: [{ lastName: "asc" }] }),
    prisma.economicPlan.findUnique({ where: { propertyId_year: { propertyId, year } } }),
    prisma.reserve.findMany({ where: { tenantId, propertyId }, include: { transactions: { orderBy: { date: "desc" } } } }),
    prisma.costEntry.findMany({ where: { tenantId, propertyId, year } }),
  ]);

  // MEA-Gewicht je Eigentümer-Zeile = unit.mea * share/1000
  const weightOf = (o: (typeof owners)[number]) => ((o.unit.mea ?? 0) * o.share) / 1000;
  const totalMea = owners.reduce((a, o) => a + weightOf(o), 0);
  const parts: AllocationParticipant[] = owners.map((o) => ({ id: o.id, mea: weightOf(o) }));

  const planTotal = plan ? Number(plan.totalAmount) : 0;
  const hausgeld = planTotal > 0 ? allocate(planTotal, "MEA", parts) : [];
  const hgById = new Map(hausgeld.map((h) => [h.id, h.amount]));

  const actualTotal = costs.reduce((a, c) => a + Number(c.amount), 0);
  const actual = actualTotal > 0 ? allocate(actualTotal, "MEA", parts) : [];
  const acById = new Map(actual.map((a) => [a.id, a.amount]));

  const reserveBalances = reserves.map((r) => ({
    r,
    balance: r.transactions.reduce((a, tx) => a + Number(tx.amount), 0),
  }));
  const assetsTotal = reserveBalances.reduce((a, x) => a + x.balance, 0);

  const unitOpts = units.map((u) => ({ value: u.id, label: u.label }));
  const personOpts = persons.map((p) => ({ value: p.id, label: `${p.lastName}, ${p.firstName}` }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("weg.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("weg.subtitle")}</p>
        </div>
        {actualTotal > 0 && (
          <Button
            variant="outline"
            size="sm"
            render={<Link href={`/print/weg?propertyId=${propertyId}&year=${year}`} target="_blank" />}
          >
            <Printer className="size-4" />
            {t("print.printPdf")}
          </Button>
        )}
      </div>

      <form className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">{t("weg.property")}</label>
          <select name="propertyId" defaultValue={propertyId} className="flex h-9 rounded-lg border border-input bg-transparent px-3 text-sm dark:bg-input/30">
            {wegProps.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">{t("statements.year")}</label>
          <select name="year" defaultValue={year} className="flex h-9 rounded-lg border border-input bg-transparent px-3 text-sm dark:bg-input/30">
            {years.map((y) => (<option key={y} value={y}>{y}</option>))}
          </select>
        </div>
        <Button type="submit" size="sm" variant="outline">{t("common.search")}</Button>
      </form>

      {/* Eigentümer & MEA */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            {t("weg.owners")} · {t("weg.totalMea")}: {totalMea}
          </CardTitle>
          <OwnerDialog units={unitOpts} persons={personOpts} />
        </CardHeader>
        <CardContent className="p-0">
          {owners.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">{t("weg.noOwners")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("weg.owners")}</TableHead>
                  <TableHead>{t("leases.unit")}</TableHead>
                  <TableHead className="text-right">MEA</TableHead>
                  <TableHead className="text-right">{t("weg.monthlyHausgeld")}</TableHead>
                  <TableHead className="w-16 text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {owners.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">
                      {o.person.firstName} {o.person.lastName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{o.unit.label}</TableCell>
                    <TableCell className="text-right">{weightOf(o)}</TableCell>
                    <TableCell className="text-right">
                      {money((hgById.get(o.id) ?? 0) / 12, locale)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <DeleteButton action={deleteOwner} id={o.id} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Wirtschaftsplan */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            {t("weg.plan")} {year}
            {plan ? ` · ${t("weg.planTotal")}: ${money(planTotal, locale)}` : ""}
          </CardTitle>
          <PlanDialog
            propertyId={propertyId}
            year={year}
            plan={plan ? { totalAmount: String(plan.totalAmount), note: plan.note } : undefined}
          />
        </CardHeader>
        <CardContent>
          {!plan ? <p className="text-sm text-muted-foreground">{t("weg.noPlan")}</p> : null}
        </CardContent>
      </Card>

      {/* Jahresabrechnung */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("weg.annual")} {year} · {t("weg.actualTotal")}: {money(actualTotal, locale)}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {owners.length === 0 || actualTotal === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">{t("weg.noActual")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("weg.owners")}</TableHead>
                  <TableHead className="text-right">{t("statements.allocated")}</TableHead>
                  <TableHead className="text-right">{t("weg.yearlyHausgeld")}</TableHead>
                  <TableHead className="text-right">{t("statements.balance")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {owners.map((o) => {
                  const alloc = acById.get(o.id) ?? 0;
                  const prepay = hgById.get(o.id) ?? 0;
                  const bal = Math.round((prepay - alloc) * 100) / 100;
                  return (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">
                        {o.person.firstName} {o.person.lastName}
                      </TableCell>
                      <TableCell className="text-right">{money(alloc, locale)}</TableCell>
                      <TableCell className="text-right">{money(prepay, locale)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={bal >= 0 ? "secondary" : "destructive"}>
                          {money(bal, locale)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Rücklagen */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">{t("weg.reserves")}</CardTitle>
            <ReserveDialog propertyId={propertyId} />
          </CardHeader>
          <CardContent className="space-y-4">
            {reserveBalances.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("weg.noReserves")}</p>
            ) : (
              reserveBalances.map(({ r, balance }) => (
                <div key={r.id} className="rounded-lg border">
                  <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
                    <div className="text-sm">
                      <span className="font-medium">{r.name}</span>
                      <span className="text-muted-foreground"> · {t("weg.balance")}: {money(balance, locale)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <ReserveTxDialog reserveId={r.id} />
                      <DeleteButton action={deleteReserve} id={r.id} />
                    </div>
                  </div>
                  {r.transactions.length > 0 && (
                    <div className="divide-y">
                      {r.transactions.map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between px-3 py-1.5 text-sm">
                          <span className="text-muted-foreground">
                            {tx.date.toISOString().slice(0, 10)}
                            {tx.note ? ` · ${tx.note}` : ""}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className={Number(tx.amount) < 0 ? "text-destructive" : ""}>
                              {money(Number(tx.amount), locale)}
                            </span>
                            <DeleteButton action={deleteReserveTx} id={tx.id} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Vermögensbericht */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("weg.assets")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {reserveBalances.map(({ r, balance }) => (
              <div key={r.id} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{r.name}</span>
                <span>{money(balance, locale)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>{t("weg.assetsTotal")}</span>
              <span>{money(assetsTotal, locale)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
