import { getTranslations, getLocale } from "next-intl/server";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { date } from "@/lib/format";
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
import { Clock } from "lucide-react";
import { TicketDialog, ContractorDialog, MaintenanceDialog } from "@/components/ticket-dialogs";
import { DeleteButton } from "@/components/delete-button";
import {
  deleteTicket,
  deleteContractor,
  deleteMaintenance,
  advanceMaintenance,
  addTicketTime,
} from "@/server/actions/maintenance";

export default async function TicketsPage() {
  const user = await requireUser();
  const t = await getTranslations();
  const locale = await getLocale();
  const tenantId = user.tenantId;

  const [tickets, contractors, maintenance, properties, units, users] = await Promise.all([
    prisma.ticket.findMany({
      where: { tenantId },
      include: { property: true, unit: true, contractor: true, assignee: true },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    }),
    prisma.contractor.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
    prisma.maintenanceContract.findMany({ where: { tenantId }, include: { property: true, contractor: true }, orderBy: { nextDue: "asc" } }),
    prisma.property.findMany({ where: { tenantId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
    prisma.unit.findMany({ where: { tenantId }, include: { building: { include: { property: true } } }, orderBy: { createdAt: "asc" } }),
    prisma.user.findMany({ where: { tenantId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const propertyOpts = properties.map((p) => ({ value: p.id, label: p.name }));
  const unitOpts = units.map((u) => ({ value: u.id, label: `${u.building.property.name} · ${u.label}` }));
  const contractorOpts = contractors.map((c) => ({ value: c.id, label: `${c.name} (${c.trade})` }));
  const userOpts = users.map((u) => ({ value: u.id, label: u.name }));

  const now = new Date();
  const prioVariant = (p: string) => (p === "HOCH" ? "destructive" : p === "MITTEL" ? "secondary" : "outline");
  const statusVariant = (s: string) =>
    s === "ERLEDIGT" ? "secondary" : s === "IN_ARBEIT" ? "default" : s === "WARTEND" ? "outline" : "outline";
  const fmtTime = (min: number) => `${Math.floor(min / 60)}h ${min % 60}m`;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("tickets.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("tickets.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" render={<a href="/api/export/tickets" />}>
            {t("common.exportCsv")}
          </Button>
          <TicketDialog properties={propertyOpts} units={unitOpts} contractors={contractorOpts} users={userOpts} />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {tickets.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">{t("tickets.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("fields.name")}</TableHead>
                  <TableHead>{t("tickets.category")}</TableHead>
                  <TableHead>{t("tickets.priority")}</TableHead>
                  <TableHead>{t("tickets.status")}</TableHead>
                  <TableHead>{t("tickets.dueDate")}</TableHead>
                  <TableHead>{t("tickets.assignee")}</TableHead>
                  <TableHead className="text-right">{t("tickets.time")}</TableHead>
                  <TableHead className="w-32 text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((tk) => {
                  const overdue = tk.dueDate && tk.dueDate < now && tk.status !== "ERLEDIGT";
                  return (
                    <TableRow key={tk.id}>
                      <TableCell className="font-medium">{tk.title}</TableCell>
                      <TableCell className="text-muted-foreground">{t(`ticketCategory.${tk.category}`)}</TableCell>
                      <TableCell>
                        <Badge variant={prioVariant(tk.priority)}>{t(`ticketPriority.${tk.priority}`)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(tk.status)}>{t(`ticketStatus.${tk.status}`)}</Badge>
                      </TableCell>
                      <TableCell className={overdue ? "font-medium text-destructive" : "text-muted-foreground"}>
                        {tk.dueDate ? date(tk.dueDate, locale) : t("common.none")}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {tk.assignee?.name ?? t("tickets.unassigned")}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{fmtTime(tk.timeSpentMin)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {/* Zeit erfassen: +15 min Schnellbuchung */}
                          <form action={addTicketTime}>
                            <input type="hidden" name="id" value={tk.id} />
                            <input type="hidden" name="minutes" value="15" />
                            <Button type="submit" variant="ghost" size="icon" aria-label={t("tickets.addTime")}>
                              <Clock className="size-4" />
                            </Button>
                          </form>
                          <TicketDialog
                            properties={propertyOpts}
                            units={unitOpts}
                            contractors={contractorOpts}
                            users={userOpts}
                            ticket={{
                              id: tk.id,
                              title: tk.title,
                              description: tk.description,
                              category: tk.category,
                              priority: tk.priority,
                              status: tk.status,
                              propertyId: tk.propertyId,
                              unitId: tk.unitId,
                              contractorId: tk.contractorId,
                              assigneeId: tk.assigneeId,
                              dueDate: tk.dueDate,
                              reminderDate: tk.reminderDate,
                            }}
                          />
                          <DeleteButton action={deleteTicket} id={tk.id} />
                        </div>
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
        {/* Handwerker */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">{t("tickets.contractors")}</CardTitle>
            <ContractorDialog />
          </CardHeader>
          <CardContent className="space-y-2">
            {contractors.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("tickets.noContractors")}</p>
            ) : (
              contractors.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div className="text-sm">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-muted-foreground"> · {c.trade}</span>
                    {c.phone || c.email ? (
                      <div className="text-xs text-muted-foreground">{[c.phone, c.email].filter(Boolean).join(" · ")}</div>
                    ) : null}
                  </div>
                  <DeleteButton action={deleteContractor} id={c.id} />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Wartung */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">{t("tickets.maintenance")}</CardTitle>
            <MaintenanceDialog properties={propertyOpts} contractors={contractorOpts} />
          </CardHeader>
          <CardContent className="space-y-2">
            {maintenance.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("tickets.noMaintenance")}</p>
            ) : (
              maintenance.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div className="text-sm">
                    <span className="font-medium">{m.title}</span>
                    <div className="text-xs text-muted-foreground">
                      {m.property.name} · {t("tickets.nextDue")}: {date(m.nextDue, locale)}
                      {m.nextDue < now && (
                        <Badge variant="destructive" className="ml-2">
                          {t("tickets.overdue")}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <form action={advanceMaintenance}>
                      <input type="hidden" name="id" value={m.id} />
                      <Button type="submit" variant="ghost" size="sm">
                        {t("tickets.markNext")}
                      </Button>
                    </form>
                    <DeleteButton action={deleteMaintenance} id={m.id} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
