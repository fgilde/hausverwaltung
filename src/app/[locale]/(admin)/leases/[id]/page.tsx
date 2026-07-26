import { ArrowLeft, X, Check } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { money, date } from "@/lib/format";
import { depositInterest } from "@/lib/deposit";
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
import {
  LeaseDialog,
  ComponentDialog,
  AdjustmentDialog,
  DepositDialog,
  RenterDialog,
} from "@/components/lease-dialogs";
import { DeleteButton } from "@/components/delete-button";
import {
  deleteLease,
  deleteRenter,
  deleteComponent,
  deleteAdjustment,
  applyAdjustment,
  deleteDeposit,
} from "@/server/actions/leases";

export default async function LeaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const t = await getTranslations();
  const locale = await getLocale();

  const lease = await prisma.lease.findFirst({
    where: { id, tenantId: user.tenantId },
    include: {
      unit: { include: { building: { include: { property: true } } } },
      renters: { include: { person: true } },
      components: { orderBy: { type: "asc" } },
      adjustments: { orderBy: { effectiveDate: "asc" } },
      deposit: { include: { account: true } },
    },
  });
  if (!lease) notFound();

  const [persons, units, kautionAccounts] = await Promise.all([
    prisma.person.findMany({
      where: { tenantId: user.tenantId },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.unit.findMany({
      where: { tenantId: user.tenantId },
      include: { building: { include: { property: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.account.findMany({
      where: { tenantId: user.tenantId, type: "KAUTION" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const personOpts = persons.map((p) => ({ value: p.id, label: `${p.lastName}, ${p.firstName}` }));
  const unitOpts = units.map((u) => ({
    value: u.id,
    label: `${u.building.property.name} · ${u.building.name} · ${u.label}`,
  }));
  const accountOpts = kautionAccounts.map((a) => ({ value: a.id, label: a.name }));

  const warm = Number(lease.rentCold) + lease.components.reduce((a, c) => a + Number(c.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" render={<Link href="/leases" />}>
            <ArrowLeft className="size-4" />
            {t("leases.title")}
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">
            {lease.unit.building.property.name} · {lease.unit.label}
          </h1>
          <p className="text-sm text-muted-foreground">
            {date(lease.startDate, locale)} – {lease.endDate ? date(lease.endDate, locale) : t("leases.unlimited")}
          </p>
        </div>
        <div className="flex gap-1">
          <LeaseDialog
            units={unitOpts}
            lease={{
              id: lease.id,
              unitId: lease.unitId,
              startDate: lease.startDate,
              endDate: lease.endDate,
              rentCold: String(lease.rentCold),
              personCount: lease.personCount,
              noticePeriodM: lease.noticePeriodM,
            }}
          />
          <DeleteButton action={deleteLease} id={lease.id} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Mieter */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">{t("renter.title")}</CardTitle>
            <RenterDialog leaseId={lease.id} persons={personOpts} />
          </CardHeader>
          <CardContent className="space-y-2">
            {lease.renters.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("renter.empty")}</p>
            ) : (
              lease.renters.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span className="text-sm">
                    {r.person.firstName} {r.person.lastName}
                    {r.person.email ? ` · ${r.person.email}` : ""}
                  </span>
                  <form action={deleteRenter}>
                    <input type="hidden" name="id" value={r.id} />
                    <Button type="submit" variant="ghost" size="icon" aria-label={t("common.delete")}>
                      <X className="size-4" />
                    </Button>
                  </form>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Kaution */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">{t("deposit.title")}</CardTitle>
            <DepositDialog
              leaseId={lease.id}
              accounts={accountOpts}
              deposit={
                lease.deposit
                  ? {
                      id: lease.deposit.id,
                      type: lease.deposit.type,
                      amount: String(lease.deposit.amount),
                      accountId: lease.deposit.accountId,
                      interestRate: lease.deposit.interestRate ? String(lease.deposit.interestRate) : null,
                      receivedDate: lease.deposit.receivedDate,
                      returnedDate: lease.deposit.returnedDate,
                    }
                  : undefined
              }
            />
          </CardHeader>
          <CardContent>
            {!lease.deposit ? (
              <p className="text-sm text-muted-foreground">{t("deposit.empty")}</p>
            ) : (
              (() => {
                const dep = lease.deposit;
                const interest = depositInterest(
                  Number(dep.amount),
                  dep.interestRate ? Number(dep.interestRate) : null,
                  dep.receivedDate,
                  dep.returnedDate,
                );
                return (
                  <div className="flex items-start justify-between">
                    <div className="space-y-0.5 text-sm">
                      <div className="font-medium">{money(Number(dep.amount), locale)}</div>
                      <div className="text-muted-foreground">
                        {t(`depositType.${dep.type}`)}
                        {dep.account ? ` · ${dep.account.name}` : ""}
                        {dep.receivedDate ? ` · ${date(dep.receivedDate, locale)}` : ""}
                      </div>
                      {interest > 0 && (
                        <div className="text-muted-foreground">
                          {t("deposit.interest")}: {money(interest, locale)} ·{" "}
                          {t("deposit.total")}: {money(Number(dep.amount) + interest, locale)}
                        </div>
                      )}
                      {dep.returnedDate && (
                        <div className="text-xs text-muted-foreground">
                          {t("deposit.returnedDate")}: {date(dep.returnedDate, locale)}
                        </div>
                      )}
                    </div>
                    <DeleteButton action={deleteDeposit} id={dep.id} />
                  </div>
                );
              })()
            )}
          </CardContent>
        </Card>
      </div>

      {/* Miet-Bestandteile */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            {t("rentComponent.title")} · {t("leases.warmRent")}: {money(warm, locale)}
          </CardTitle>
          <ComponentDialog leaseId={lease.id} />
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">{t("leases.coldRent")}</TableCell>
                <TableCell className="text-right">{money(Number(lease.rentCold), locale)}</TableCell>
                <TableCell className="w-12" />
              </TableRow>
              {lease.components.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    {t(`rentComponentType.${c.type}`)}
                    {c.note ? ` · ${c.note}` : ""}
                  </TableCell>
                  <TableCell className="text-right">{money(Number(c.amount), locale)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <DeleteButton action={deleteComponent} id={c.id} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Mietanpassungen */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{t("adjustment.title")}</CardTitle>
          <AdjustmentDialog leaseId={lease.id} />
        </CardHeader>
        <CardContent className="p-0">
          {lease.adjustments.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">{t("adjustment.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("fields.type")}</TableHead>
                  <TableHead>{t("adjustment.effectiveDate")}</TableHead>
                  <TableHead className="text-right">{t("adjustment.newRent")}</TableHead>
                  <TableHead>{t("leases.status")}</TableHead>
                  <TableHead className="w-28 text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lease.adjustments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{t(`adjustmentType.${a.type}`)}</TableCell>
                    <TableCell>{date(a.effectiveDate, locale)}</TableCell>
                    <TableCell className="text-right">{money(Number(a.newRentCold), locale)}</TableCell>
                    <TableCell>
                      <Badge variant={a.applied ? "secondary" : "outline"}>
                        {a.applied ? t("adjustment.applied") : t("adjustment.planned")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {!a.applied && (
                          <form action={applyAdjustment}>
                            <input type="hidden" name="id" value={a.id} />
                            <Button type="submit" variant="ghost" size="icon" aria-label={t("adjustment.apply")}>
                              <Check className="size-4" />
                            </Button>
                          </form>
                        )}
                        <DeleteButton action={deleteAdjustment} id={a.id} />
                      </div>
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
