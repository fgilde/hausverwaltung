import { headers } from "next/headers";
import { getTranslations, getLocale } from "next-intl/server";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { BankSync } from "@/components/bank-sync";
import { money, date } from "@/lib/format";
import { getDateLocale } from "@/lib/date-locale";
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
import { DunningDialog } from "@/components/dunning-dialog";
import { PaymentEditDialog } from "@/components/payment-dialog-edit";
import { summarizeTransactions } from "@/lib/transactions";
import { deleteCharge, deleteAccount, deleteMandate, deletePayment, seedDefaultAccounts } from "@/server/actions/finances";

export default async function FinancesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string; lease?: string; year?: string }>;
}) {
  const sp = await searchParams;
  const statusFilter = sp.status ?? "";
  const typeFilter = sp.type ?? "";
  const leaseFilter = sp.lease ?? "";
  const yearFilter = sp.year ?? "";
  const user = await requireUser();
  const t = await getTranslations();
  const locale = await getLocale();
  const df = await getDateLocale(locale);
  const tenantId = user.tenantId;

  const [charges, accounts, mandates, leases, persons, bankConnector, bankLinks, payments, allDocuments] = await Promise.all([
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
    prisma.bankConnector.findUnique({ where: { tenantId } }),
    prisma.bankLink.findMany({ where: { tenantId }, include: { account: { select: { name: true } } }, orderBy: { createdAt: "asc" } }),
    // Kontobewegungen (Zahlungen) inkl. Konto, zugeordneter Sollstellung und Belegen (#23).
    prisma.payment.findMany({
      where: { tenantId },
      include: {
        account: { select: { name: true } },
        charge: { select: { type: true } },
        documents: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
      take: 200,
    }),
    prisma.document.findMany({ where: { tenantId }, select: { id: true, name: true }, orderBy: { createdAt: "desc" } }),
  ]);
  const txnSummary = summarizeTransactions(
    payments.map((p) => ({ direction: p.direction, amount: Number(p.amount) })),
  );
  const isAdmin = user.role === "ADMIN";
  const h = await headers();
  const bankHost = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const bankProto = h.get("x-forwarded-proto") ?? (bankHost.startsWith("localhost") ? "http" : "https");
  const bankRedirectUrl = `${bankProto}://${bankHost}/api/banking/callback`;
  const bankLinkItems = bankLinks.map((l) => ({
    id: l.id,
    aspspName: l.aspspName,
    accountName: l.account.name,
    lastSyncAt: l.lastSyncAt ? l.lastSyncAt.toISOString().slice(0, 10) : null,
  }));

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
  const STATUSES = ["OPEN", "PARTIAL", "PAID", "OVERDUE"];
  const CHARGE_TYPES = ["MIETE", "NEBENKOSTEN", "HAUSGELD", "KAUTION", "SONSTIGES"];
  const years = [...new Set(charges.map((c) => c.period.getUTCFullYear()))].sort((a, b) => b - a);
  const visibleRows = rows.filter(
    (r) =>
      (!statusFilter || r.status === statusFilter) &&
      (!typeFilter || r.c.type === typeFilter) &&
      (!leaseFilter || r.c.leaseId === leaseFilter) &&
      (!yearFilter || r.c.period.getUTCFullYear() === Number(yearFilter)),
  );

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
            <Button size="sm" variant="outline" render={<a href="/api/export/openitems" />}>
              <Download className="size-4" />
              {t("finances.openItemsCsv")}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{t("finances.openItems")}</CardTitle>
          <form className="flex flex-wrap items-center gap-2">
            <select
              name="status"
              defaultValue={statusFilter}
              className="flex h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
            >
              <option value="">{t("finances.allStatus")}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{t(`finances.status${s}`)}</option>
              ))}
            </select>
            <select
              name="type"
              defaultValue={typeFilter}
              className="flex h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
            >
              <option value="">{t("finances.allTypes")}</option>
              {CHARGE_TYPES.map((s) => (
                <option key={s} value={s}>{t(`chargeType.${s}`)}</option>
              ))}
            </select>
            <select
              name="lease"
              defaultValue={leaseFilter}
              className="flex h-8 max-w-48 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
            >
              <option value="">{t("finances.allLeases")}</option>
              {leaseOpts.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <select
              name="year"
              defaultValue={yearFilter}
              className="flex h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
            >
              <option value="">{t("finances.allYears")}</option>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <Button type="submit" size="sm" variant="outline">{t("common.search")}</Button>
          </form>
        </CardHeader>
        <CardContent className="p-0">
          {visibleRows.length === 0 ? (
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
                {visibleRows.map(({ c, open, status, dunLevel }) => (
                  <TableRow key={c.id}>
                    <TableCell>{date(c.period, df)}</TableCell>
                    <TableCell>{t(`chargeType.${c.type}`)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.lease ? (
                        <div className="flex flex-col">
                          <Link
                            href={`/units/${c.lease.unit.id}`}
                            className="font-medium text-foreground hover:underline"
                          >
                            {c.lease.unit.building.property.name} · {c.lease.unit.label}
                          </Link>
                          {c.lease.renters.length > 0 && (
                            <Link href={`/leases/${c.leaseId}`} className="text-xs hover:underline">
                              {c.lease.renters.map((r) => `${r.person.firstName} ${r.person.lastName}`).join(", ")}
                            </Link>
                          )}
                        </div>
                      ) : (
                        t("common.none")
                      )}
                    </TableCell>
                    <TableCell className="text-right">{money(Number(c.amount), locale)}</TableCell>
                    <TableCell className="text-right">{money(Math.max(0, open), locale)}</TableCell>
                    <TableCell>{date(c.dueDate, df)}</TableCell>
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
                          <DunningDialog
                            chargeId={c.id}
                            renterName={
                              c.lease?.renters[0]
                                ? `${c.lease.renters[0].person.firstName} ${c.lease.renters[0].person.lastName}`
                                : ""
                            }
                            hasEmail={!!c.lease?.renters[0]?.person.email}
                          />
                        )}
                        {dunLevel > 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t("print.printPdf")}
                            render={<a href={`/api/dunning/${c.id}/pdf`} target="_blank" rel="noopener noreferrer" />}
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

      {/* Kontobewegungen (#23) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("finances.transactions")}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {t("finances.transIn")}: {money(txnSummary.inTotal, locale)} · {t("finances.transOut")}:{" "}
            {money(txnSummary.outTotal, locale)} · {t("finances.transNet")}: {money(txnSummary.net, locale)}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {payments.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">{t("finances.noTransactions")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("fields.date")}</TableHead>
                  <TableHead>{t("finances.account")}</TableHead>
                  <TableHead>{t("finances.reference")}</TableHead>
                  <TableHead className="text-right">{t("fields.amount")}</TableHead>
                  <TableHead>{t("documents.title")}</TableHead>
                  <TableHead className="w-20 text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{date(p.date, df)}</TableCell>
                    <TableCell className="text-muted-foreground">{p.account?.name ?? t("common.none")}</TableCell>
                    <TableCell
                      className="max-w-[28rem] whitespace-normal break-words text-muted-foreground"
                      title={p.reference || undefined}
                    >
                      {p.reference || (p.charge ? t(`chargeType.${p.charge.type}`) : "")}
                      {p.note ? <span className="mt-0.5 block text-xs italic">{p.note}</span> : null}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${p.direction === "EINGANG" ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                      {p.direction === "EINGANG" ? "+" : "−"}
                      {money(Number(p.amount), locale)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.documents.length > 0 ? (
                        <span className="flex flex-col gap-0.5">
                          {p.documents.map((d) => (
                            <a
                              key={d.id}
                              href={`/api/documents/${d.id}`}
                              className="truncate text-xs hover:underline"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {d.name}
                            </a>
                          ))}
                        </span>
                      ) : (
                        <span className="text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <PaymentEditDialog
                          payment={{ id: p.id, note: p.note, documentIds: p.documents.map((d) => d.id) }}
                          documents={allDocuments}
                        />
                        <DeleteButton action={deletePayment} id={p.id} />
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
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{t("finances.noAccounts")}</p>
                <form action={seedDefaultAccounts}>
                  <Button type="submit" variant="outline" size="sm">{t("finances.seedAccounts")}</Button>
                </form>
              </div>
            ) : (
              accounts.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div className="text-sm">
                    <span className="font-medium">{a.name}</span>
                    <span className="text-muted-foreground"> · {t(`accountType.${a.type}`)}</span>
                    {a.iban ? <div className="text-xs text-muted-foreground">{a.iban}</div> : null}
                  </div>
                  <div className="flex items-center gap-1">
                    <AccountDialog account={{ id: a.id, name: a.name, type: a.type, iban: a.iban }} />
                    <DeleteButton action={deleteAccount} id={a.id} />
                  </div>
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

      {(bankConnector || isAdmin) && (
        <BankSync
          isAdmin={isAdmin}
          connector={
            bankConnector
              ? { applicationId: bankConnector.applicationId, baseUrl: bankConnector.baseUrl, psuType: bankConnector.psuType, hasKey: true }
              : null
          }
          redirectUrl={bankRedirectUrl}
          links={bankLinkItems}
        />
      )}
    </div>
  );
}
