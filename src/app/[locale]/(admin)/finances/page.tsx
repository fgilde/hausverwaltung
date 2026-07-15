import { Bell } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { money, date } from "@/lib/format";
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
import { Download, Printer } from "lucide-react";
import { Link } from "@/i18n/navigation";
import {
  AccountDialog,
  GenerateDialog,
  ChargeDialog,
  PaymentDialog,
  MandateDialog,
  CamtDialog,
} from "@/components/finance-dialogs";
import { DeleteButton } from "@/components/delete-button";
import { deleteCharge, deleteAccount, deleteMandate, createDunning } from "@/server/actions/finances";

export default async function FinancesPage() {
  const user = await requireUser();
  const t = await getTranslations();
  const locale = await getLocale();
  const tenantId = user.tenantId;

  const [charges, accounts, mandates, leases, persons] = await Promise.all([
    prisma.charge.findMany({
      where: { tenantId },
      include: {
        payments: { select: { amount: true } },
        dunnings: { select: { level: true } },
        lease: { include: { unit: { include: { building: { include: { property: true } } } }, renters: { include: { person: true } } } },
      },
      orderBy: [{ dueDate: "desc" }],
    }),
    prisma.account.findMany({ where: { tenantId }, orderBy: { createdAt: "asc" } }),
    prisma.sepaMandate.findMany({ where: { tenantId }, include: { person: true }, orderBy: { createdAt: "desc" } }),
    prisma.lease.findMany({ where: { tenantId }, include: { unit: { include: { building: { include: { property: true } } } } } }),
    prisma.person.findMany({ where: { tenantId }, orderBy: [{ lastName: "asc" }] }),
  ]);

  const now = new Date();
  const rows = charges.map((c) => {
    const paid = c.payments.reduce((a, p) => a + Number(p.amount), 0);
    const open = Number(c.amount) - paid;
    let status: "OPEN" | "PARTIAL" | "PAID" | "OVERDUE";
    if (open <= 0.001) status = "PAID";
    else if (c.dueDate < now) status = "OVERDUE";
    else status = paid > 0 ? "PARTIAL" : "OPEN";
    const dunLevel = c.dunnings.reduce((m, d) => Math.max(m, d.level), 0);
    return { c, paid, open, status, dunLevel };
  });
  const totalOpen = rows.reduce((a, r) => a + Math.max(0, r.open), 0);

  const accountOpts = accounts.map((a) => ({ value: a.id, label: a.name }));
  const leaseOpts = leases.map((l) => ({
    value: l.id,
    label: `${l.unit.building.property.name} · ${l.unit.label}`,
  }));
  const personOpts = persons.map((p) => ({ value: p.id, label: `${p.lastName}, ${p.firstName}` }));

  const statusVariant = (s: string) =>
    s === "PAID" ? "secondary" : s === "OVERDUE" ? "destructive" : "outline";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("finances.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("finances.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <GenerateDialog />
          <ChargeDialog leases={leaseOpts} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("finances.totalOpen")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{money(totalOpen, locale)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("finances.importExport")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <CamtDialog accounts={accountOpts} />
            <Button size="sm" variant="outline" render={<a href="/api/export/datev" />}>
              <Download className="size-4" />
              {t("finances.datevExport")}
            </Button>
            <Button size="sm" variant="outline" render={<a href="/api/export/sepa" />}>
              <Download className="size-4" />
              {t("finances.sepaExport")}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("finances.openItems")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">{t("finances.noOpenItems")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("finances.period")}</TableHead>
                  <TableHead>{t("fields.type")}</TableHead>
                  <TableHead>{t("leases.unit")}</TableHead>
                  <TableHead className="text-right">{t("fields.amount")}</TableHead>
                  <TableHead className="text-right">{t("finances.open")}</TableHead>
                  <TableHead>{t("finances.due")}</TableHead>
                  <TableHead>{t("leases.status")}</TableHead>
                  <TableHead className="w-32 text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ c, open, status, dunLevel }) => (
                  <TableRow key={c.id}>
                    <TableCell>{date(c.period, locale)}</TableCell>
                    <TableCell>{t(`chargeType.${c.type}`)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.lease ? `${c.lease.unit.building.property.name} · ${c.lease.unit.label}` : t("common.none")}
                    </TableCell>
                    <TableCell className="text-right">{money(Number(c.amount), locale)}</TableCell>
                    <TableCell className="text-right">{money(Math.max(0, open), locale)}</TableCell>
                    <TableCell>{date(c.dueDate, locale)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Badge variant={statusVariant(status)}>{t(`finances.status${status}`)}</Badge>
                        {dunLevel > 0 && <Badge variant="outline">M{dunLevel}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <PaymentDialog chargeId={c.id} defaultAmount={Math.max(0, open)} accounts={accountOpts} />
                        {status === "OVERDUE" && dunLevel < 3 && (
                          <form action={createDunning}>
                            <input type="hidden" name="chargeId" value={c.id} />
                            <Button type="submit" variant="ghost" size="icon" aria-label={t("finances.dun")}>
                              <Bell className="size-4" />
                            </Button>
                          </form>
                        )}
                        {dunLevel > 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t("print.printPdf")}
                            render={<Link href={`/print/dunning?chargeId=${c.id}`} target="_blank" />}
                          >
                            <Printer className="size-4" />
                          </Button>
                        )}
                        <DeleteButton action={deleteCharge} id={c.id} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">{t("finances.accounts")}</CardTitle>
            <AccountDialog />
          </CardHeader>
          <CardContent className="space-y-2">
            {accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("finances.noAccounts")}</p>
            ) : (
              accounts.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div className="text-sm">
                    <span className="font-medium">{a.name}</span>
                    <span className="text-muted-foreground"> · {t(`accountType.${a.type}`)}</span>
                    {a.iban ? <div className="text-xs text-muted-foreground">{a.iban}</div> : null}
                  </div>
                  <DeleteButton action={deleteAccount} id={a.id} />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">{t("finances.mandates")}</CardTitle>
            <MandateDialog persons={personOpts} />
          </CardHeader>
          <CardContent className="space-y-2">
            {mandates.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("finances.noMandates")}</p>
            ) : (
              mandates.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div className="text-sm">
                    <span className="font-medium">
                      {m.person.firstName} {m.person.lastName}
                    </span>
                    <div className="text-xs text-muted-foreground">
                      {m.iban} · {m.mandateRef}
                    </div>
                  </div>
                  <DeleteButton action={deleteMandate} id={m.id} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
