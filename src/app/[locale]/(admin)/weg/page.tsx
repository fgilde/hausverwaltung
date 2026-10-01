import { getTranslations, getLocale } from "next-intl/server";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { money, decimal } from "@/lib/format";
import { checkMeaTotal } from "@/lib/weg-validation";
import { computeWeg } from "@/server/weg";
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
import { OwnerDialog, PlanDialog, ReserveDialog, ReserveTxDialog, SubcommunityDialog } from "@/components/weg-dialogs";
import { CostDialog } from "@/components/cost-dialog";
import { DeleteButton } from "@/components/delete-button";
import { deleteOwner, deleteReserve, deleteReserveTx, deleteSubcommunity } from "@/server/actions/weg";
import { deleteCost } from "@/server/actions/costs";
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
    select: { id: true, name: true, meaTotal: true },
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

  const [weg, persons] = await Promise.all([
    computeWeg(tenantId, propertyId, year),
    prisma.person.findMany({ where: { tenantId }, orderBy: [{ lastName: "asc" }] }),
  ]);
  const { owners, units, subcommunities, scopes, costs, actualTotal, reserves, unassigned } = weg;

  // Validierung: Summe der Einheiten-MEA gegen Soll des Objekts
  const meaTotalSoll = wegProps.find((p) => p.id === propertyId)?.meaTotal ?? 1000;
  const meaCheck = checkMeaTotal(units.map((u) => u.mea), meaTotalSoll);
  const assetsTotal = reserves.reduce((a, x) => a + x.balance, 0);

  const subName = new Map(subcommunities.map((s) => [s.id, s.name]));
  const scopeLabel = (id: string | null) => (id ? (subName.get(id) ?? "—") : t("weg.wholeCommunity"));
  const unitOpts = units.map((u) => ({ value: u.id, label: u.label }));
  const subOpts = subcommunities.map((s) => ({ value: s.id, label: s.name }));
  const personOpts = persons.map((p) => ({ value: p.id, label: `${p.lastName}, ${p.firstName}` }));
  const unitById = new Map(units.map((u) => [u.id, u]));

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

      {/* MEA-Prüfung */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("weg.meaCheck")}
          </CardTitle>
          <Badge variant={meaCheck.ok ? "secondary" : "destructive"}>
            {decimal(meaCheck.sum, locale)} / {decimal(meaCheck.meaTotal, locale)} ‰ {meaCheck.ok ? "✓" : `(${meaCheck.diff > 0 ? "+" : ""}${decimal(meaCheck.diff, locale)})`}
          </Badge>
        </CardHeader>
        {!meaCheck.ok && (
          <CardContent className="pt-0">
            <p className="text-sm text-destructive">{t("weg.meaMismatch")}</p>
          </CardContent>
        )}
      </Card>

      {/* Untergemeinschaften (#42) */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-base">{t("weg.subcommunities")}</CardTitle>
            <p className="text-xs text-muted-foreground">{t("weg.subcommunitiesHint")}</p>
          </div>
          <SubcommunityDialog propertyId={propertyId} units={unitOpts} />
        </CardHeader>
        <CardContent className="space-y-2">
          {subcommunities.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("weg.noSubcommunities")}</p>
          ) : (
            scopes
              .filter((s) => s.id)
              .map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium">{s.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {s.units.length ? s.units.map((u) => u.label).join(", ") : t("weg.noUnitsAssigned")}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="outline">
                      {t("weg.meaBasis")}: {decimal(s.meaSum, locale)}
                    </Badge>
                    <SubcommunityDialog
                      propertyId={propertyId}
                      units={unitOpts}
                      subcommunity={{ id: s.id!, name: s.name!, unitIds: s.units.map((u) => u.id) }}
                    />
                    <DeleteButton action={deleteSubcommunity} id={s.id!} />
                  </div>
                </div>
              ))
          )}
        </CardContent>
      </Card>

      {/* Eigentümer & MEA */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            {t("weg.owners")} · {t("weg.totalMea")}: {decimal(meaCheck.sum, locale)}
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
                  {subcommunities.length > 0 && <TableHead>{t("weg.subcommunity")}</TableHead>}
                  <TableHead className="text-right">MEA</TableHead>
                  <TableHead className="text-right">{t("weg.share")}</TableHead>
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
                    {subcommunities.length > 0 && (
                      <TableCell className="text-muted-foreground">
                        {o.unit.subcommunityId ? subName.get(o.unit.subcommunityId) : "—"}
                      </TableCell>
                    )}
                    <TableCell className="text-right">{decimal(o.unit.mea, locale)}</TableCell>
                    <TableCell className="text-right">{decimal(o.share, locale)}‰</TableCell>
                    <TableCell className="text-right">{money(o.line.hausgeld / 12, locale)}</TableCell>
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

      {/* Wirtschaftsplan je Kreis */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("weg.plan")} {year}
          </CardTitle>
          {subcommunities.length > 0 && <p className="text-xs text-muted-foreground">{t("weg.planHint")}</p>}
        </CardHeader>
        <CardContent className="space-y-2">
          {scopes.map((s) => (
            <div key={s.id ?? "all"} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
              <div>
                <span className="font-medium">{scopeLabel(s.id)}</span>
                <span className="text-muted-foreground">
                  {" · "}
                  {s.hasPlan ? `${t("weg.planTotal")}: ${money(s.planTotal, locale)}` : t("weg.noPlan")}
                  {s.id && ` · ${t("weg.meaBasis")} ${decimal(s.meaSum, locale)}`}
                </span>
              </div>
              <PlanDialog
                propertyId={propertyId}
                year={year}
                subcommunity={s.id ? { id: s.id, name: s.name! } : undefined}
                plan={s.hasPlan ? { totalAmount: String(s.planTotal), note: s.planNote } : undefined}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Jahresabrechnung */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            {t("weg.annual")} {year} · {t("weg.actualTotal")}: {money(actualTotal, locale)}
          </CardTitle>
          <CostDialog propertyId={propertyId} year={year} subcommunities={subOpts} />
        </CardHeader>
        <CardContent className="space-y-4 p-0">
          {costs.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("weg.costItem")}</TableHead>
                  <TableHead>{t("weg.scope")}</TableHead>
                  <TableHead>{t("statements.method")}</TableHead>
                  <TableHead className="text-right">{t("fields.amount")}</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {costs.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      {t(`costType.${c.type}`)}
                      {c.note && <span className="font-normal text-muted-foreground"> · {c.note}</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.subcommunityId ? "outline" : "secondary"}>{scopeLabel(c.subcommunityId)}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{t(`allocationMethod.${c.method}`)}</TableCell>
                    <TableCell className="text-right">{money(Number(c.amount), locale)}</TableCell>
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
          {owners.length === 0 || actualTotal === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">{t("weg.noActual")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("weg.owners")}</TableHead>
                  <TableHead>{t("leases.unit")}</TableHead>
                  <TableHead className="text-right">{t("statements.allocated")}</TableHead>
                  <TableHead className="text-right">{t("weg.yearlyHausgeld")}</TableHead>
                  <TableHead className="text-right">{t("statements.balance")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {owners.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">
                      {o.person.firstName} {o.person.lastName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{o.unit.label}</TableCell>
                    <TableCell className="text-right">{money(o.line.allocated, locale)}</TableCell>
                    <TableCell className="text-right">{money(o.line.hausgeld, locale)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={o.line.balance >= 0 ? "secondary" : "destructive"}>
                        {money(o.line.balance, locale)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {unassigned.map((x) => (
                  <TableRow key={x.unit.id} className="text-muted-foreground">
                    <TableCell>{t("weg.noOwnerUnit")}</TableCell>
                    <TableCell>{unitById.get(x.unit.id)?.label}</TableCell>
                    <TableCell className="text-right">{money(x.allocated, locale)}</TableCell>
                    <TableCell className="text-right">{money(x.hausgeld, locale)}</TableCell>
                    <TableCell />
                  </TableRow>
                ))}
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
            <ReserveDialog propertyId={propertyId} subcommunities={subOpts} />
          </CardHeader>
          <CardContent className="space-y-4">
            {reserves.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("weg.noReserves")}</p>
            ) : (
              reserves.map(({ r, balance }) => (
                <div key={r.id} className="rounded-lg border">
                  <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
                    <div className="text-sm">
                      <span className="font-medium">{r.name}</span>
                      {subcommunities.length > 0 && (
                        <Badge variant={r.subcommunityId ? "outline" : "secondary"} className="ml-2">
                          {scopeLabel(r.subcommunityId)}
                        </Badge>
                      )}
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
            {reserves.map(({ r, balance }) => (
              <div key={r.id} className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {r.name}
                  {subcommunities.length > 0 && ` (${scopeLabel(r.subcommunityId)})`}
                </span>
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
