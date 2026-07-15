import { getTranslations, getLocale } from "next-intl/server";
import {
  Building2,
  DoorOpen,
  KeyRound,
  DoorClosed,
  Banknote,
  Coins,
  Wrench,
  CalendarClock,
  Plus,
  Lightbulb,
  X,
  Check,
} from "lucide-react";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { money, date } from "@/lib/format";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CrudDialog } from "@/components/crud-dialog";
import { TextField } from "@/components/form-fields";
import { createTask, toggleTask, deleteTask } from "@/server/actions/tasks";
import { AiAssistant } from "@/components/ai-assistant";
import { MonthlyBars, OccupancyDonut } from "@/components/dashboard-charts";
import { ReminderButton } from "@/components/reminder-button";

export default async function DashboardPage() {
  const user = await requireUser();
  const t = await getTranslations();
  const locale = await getLocale();
  const tenantId = user.tenantId;
  const now = new Date();

  const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const in90 = new Date(now.getTime() + 90 * 864e5);
  const in30 = new Date(now.getTime() + 30 * 864e5);

  const [properties, units, leases, charges, openTickets, maintenance, tasks, paymentsRecent, expiringLeases, upcomingMaint] = await Promise.all([
    prisma.property.findMany({
      where: { tenantId },
      include: { buildings: { include: { _count: { select: { units: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.unit.findMany({
      where: { tenantId },
      select: { id: true, leases: { select: { startDate: true, endDate: true } } },
    }),
    prisma.lease.findMany({
      where: { tenantId, startDate: { lte: now }, OR: [{ endDate: null }, { endDate: { gte: now } }] },
      include: { components: { select: { amount: true } } },
    }),
    prisma.charge.findMany({ where: { tenantId }, include: { payments: { select: { amount: true } } } }),
    prisma.ticket.count({ where: { tenantId, status: { not: "ERLEDIGT" } } }),
    prisma.maintenanceContract.findMany({ where: { tenantId, nextDue: { lt: now } }, select: { id: true } }),
    prisma.task.findMany({ where: { tenantId, done: false }, orderBy: [{ dueDate: "asc" }], take: 8 }),
    prisma.payment.findMany({ where: { tenantId, direction: "EINGANG", date: { gte: sixMonthsAgo } }, select: { date: true, amount: true } }),
    prisma.lease.findMany({ where: { tenantId, endDate: { gte: now, lte: in90 } }, select: { id: true } }),
    prisma.maintenanceContract.count({ where: { tenantId, nextDue: { gte: now, lte: in30 } } }),
  ]);

  const isOccupied = (ls: { startDate: Date; endDate: Date | null }[]) =>
    ls.some((l) => l.startDate <= now && (!l.endDate || l.endDate >= now));
  const totalUnits = units.length;
  const occupied = units.filter((u) => isOccupied(u.leases)).length;
  const vacant = totalUnits - occupied;
  const rate = totalUnits ? Math.round((occupied / totalUnits) * 100) : 0;

  const monthlyRent = leases.reduce(
    (a, l) => a + Number(l.rentCold) + l.components.reduce((s, c) => s + Number(c.amount), 0),
    0,
  );
  let totalOpen = 0;
  let overdueCount = 0;
  for (const c of charges) {
    const open = Number(c.amount) - c.payments.reduce((a, p) => a + Number(p.amount), 0);
    if (open > 0.001) {
      totalOpen += open;
      if (c.dueDate < now) overdueCount++;
    }
  }
  const dueMaintenance = maintenance.length;

  const unitCount = (p: (typeof properties)[number]) => p.buildings.reduce((a, b) => a + b._count.units, 0);

  type Stat = { key: string; value: string; icon: typeof Building2; sub?: string };
  const stats: Stat[] = [
    { key: "properties", value: String(properties.length), icon: Building2 },
    { key: "units", value: String(totalUnits), icon: DoorOpen },
    { key: "occupied", value: String(occupied), icon: KeyRound, sub: `${t("dashboard.occupancyRate")}: ${rate}%` },
    { key: "vacant", value: String(vacant), icon: DoorClosed },
    { key: "monthlyRent", value: money(monthlyRent, locale), icon: Banknote },
    { key: "openItemsValue", value: money(totalOpen, locale), icon: Coins },
    { key: "openTickets", value: String(openTickets), icon: Wrench },
    { key: "dueMaintenance", value: String(dueMaintenance), icon: CalendarClock },
  ];

  const insights: string[] = [];
  if (overdueCount > 0) insights.push(t("dashboard.insightOverdue", { count: overdueCount }));
  if (expiringLeases.length > 0) insights.push(t("dashboard.insightExpiring", { count: expiringLeases.length }));
  if (openTickets > 0) insights.push(t("dashboard.insightTickets", { count: openTickets }));
  if (dueMaintenance > 0) insights.push(t("dashboard.insightMaintenance", { count: dueMaintenance }));
  if (upcomingMaint > 0) insights.push(t("dashboard.insightUpcomingMaint", { count: upcomingMaint }));

  // 6-Monats-Verlauf: Sollstellung vs. Zahlungseingang
  const monthly = Array.from({ length: 6 }, (_, k) => {
    const i = 5 - k;
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const soll = charges
      .filter((c) => { const p = new Date(c.period); return p.getUTCFullYear() === y && p.getUTCMonth() === m; })
      .reduce((a, c) => a + Number(c.amount), 0);
    const zahlung = paymentsRecent
      .filter((p) => { const x = new Date(p.date); return x.getUTCFullYear() === y && x.getUTCMonth() === m; })
      .reduce((a, p) => a + Number(p.amount), 0);
    const label = new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-US", { month: "short" }).format(d);
    return { label, soll, zahlung };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("dashboard.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("dashboard.subtitle")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.key}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t(`dashboard.${s.key}`)}
              </CardTitle>
              <s.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{s.value}</div>
              {"sub" in s && s.sub ? <p className="text-xs text-muted-foreground">{s.sub}</p> : null}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Diagramme */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.chartCashflow")}</CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyBars
              data={monthly}
              locale={locale}
              labels={{ soll: t("dashboard.chartSoll"), zahlung: t("dashboard.chartZahlung") }}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.chartOccupancy")}</CardTitle>
          </CardHeader>
          <CardContent>
            <OccupancyDonut
              occupied={occupied}
              vacant={vacant}
              rate={rate}
              labels={{ occupied: t("dashboard.occupied"), vacant: t("dashboard.vacant") }}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Hinweise */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="size-4" />
              {t("dashboard.insights")}
            </CardTitle>
            <ReminderButton />
          </CardHeader>
          <CardContent className="space-y-2">
            {insights.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("dashboard.allGood")}</p>
            ) : (
              insights.map((i, idx) => (
                <div key={idx} className="rounded-md border-l-2 border-primary bg-muted/40 px-3 py-2 text-sm">
                  {i}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Aufgaben */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">{t("dashboard.tasks")}</CardTitle>
            <CrudDialog
              trigger={
                <Button size="sm">
                  <Plus className="size-4" />
                  {t("dashboard.addTask")}
                </Button>
              }
              title={t("dashboard.addTask")}
              action={createTask}
              submitLabel={t("common.create")}
            >
              <TextField name="title" label={t("fields.name")} />
              <TextField name="dueDate" label={t("tickets.nextDue")} type="date" required={false} />
            </CrudDialog>
          </CardHeader>
          <CardContent className="space-y-2">
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("dashboard.noTasks")}</p>
            ) : (
              tasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <div>
                    <span>{task.title}</span>
                    {task.dueDate ? (
                      <span className={`ml-2 text-xs ${task.dueDate < now ? "text-destructive" : "text-muted-foreground"}`}>
                        {date(task.dueDate, locale)}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1">
                    <form action={toggleTask}>
                      <input type="hidden" name="id" value={task.id} />
                      <Button type="submit" variant="ghost" size="icon" aria-label={t("common.save")}>
                        <Check className="size-4" />
                      </Button>
                    </form>
                    <form action={deleteTask}>
                      <input type="hidden" name="id" value={task.id} />
                      <Button type="submit" variant="ghost" size="icon" aria-label={t("common.delete")}>
                        <X className="size-4" />
                      </Button>
                    </form>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <AiAssistant />

      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.recentProperties")}</CardTitle>
          <CardDescription>{properties.length} · HaVeWa</CardDescription>
        </CardHeader>
        <CardContent>
          {properties.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("dashboard.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("dashboard.recentProperties")}</TableHead>
                  <TableHead>{t("dashboard.type")}</TableHead>
                  <TableHead>{t("dashboard.management")}</TableHead>
                  <TableHead>{t("dashboard.location")}</TableHead>
                  <TableHead className="text-right">{t("dashboard.unitsCount")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {properties.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{t(`propertyType.${p.type}`)}</TableCell>
                    <TableCell>
                      <Badge variant={p.management === "WEG" ? "secondary" : "outline"}>
                        {t(`managementType.${p.management}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.zip} {p.city}
                    </TableCell>
                    <TableCell className="text-right">{unitCount(p)}</TableCell>
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
