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
import { TicketDialog, ContractorDialog, MaintenanceDialog } from "@/components/ticket-dialogs";
import { DeleteButton } from "@/components/delete-button";
import {
  deleteTicket,
  deleteContractor,
  deleteMaintenance,
  advanceMaintenance,
} from "@/server/actions/maintenance";

export default async function TicketsPage() {
  const user = await requireUser();
  const t = await getTranslations();
  const locale = await getLocale();
  const tenantId = user.tenantId;

  const [tickets, contractors, maintenance, properties, units] = await Promise.all([
    prisma.ticket.findMany({
      where: { tenantId },
      include: { property: true, unit: true, contractor: true },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
    prisma.contractor.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
    prisma.maintenanceContract.findMany({ where: { tenantId }, include: { property: true, contractor: true }, orderBy: { nextDue: "asc" } }),
    prisma.property.findMany({ where: { tenantId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
    prisma.unit.findMany({ where: { tenantId }, include: { building: { include: { property: true } } }, orderBy: { createdAt: "asc" } }),
  ]);

  const propertyOpts = properties.map((p) => ({ value: p.id, label: p.name }));
  const unitOpts = units.map((u) => ({ value: u.id, label: `${u.building.property.name} · ${u.label}` }));
  const contractorOpts = contractors.map((c) => ({ value: c.id, label: `${c.name} (${c.trade})` }));

  const now = new Date();
  const prioVariant = (p: string) => (p === "HOCH" ? "destructive" : p === "MITTEL" ? "secondary" : "outline");
  const statusVariant = (s: string) => (s === "ERLEDIGT" ? "secondary" : s === "IN_ARBEIT" ? "default" : "outline");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("tickets.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("tickets.subtitle")}</p>
        </div>
        <TicketDialog properties={propertyOpts} units={unitOpts} contractors={contractorOpts} />
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
                  <TableHead>{t("tickets.priority")}</TableHead>
                  <TableHead>{t("tickets.status")}</TableHead>
                  <TableHead>{t("tickets.property")}</TableHead>
                  <TableHead>{t("tickets.contractor")}</TableHead>
                  <TableHead className="w-24 text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((tk) => (
                  <TableRow key={tk.id}>
                    <TableCell className="font-medium">{tk.title}</TableCell>
                    <TableCell>
                      <Badge variant={prioVariant(tk.priority)}>{t(`ticketPriority.${tk.priority}`)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(tk.status)}>{t(`ticketStatus.${tk.status}`)}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {tk.property?.name ?? t("common.none")}
                      {tk.unit ? ` · ${tk.unit.label}` : ""}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {tk.contractor ? tk.contractor.name : t("tickets.unassigned")}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <TicketDialog
                          properties={propertyOpts}
                          units={unitOpts}
                          contractors={contractorOpts}
                          ticket={{
                            id: tk.id,
                            title: tk.title,
                            description: tk.description,
                            priority: tk.priority,
                            status: tk.status,
                            propertyId: tk.propertyId,
                            unitId: tk.unitId,
                            contractorId: tk.contractorId,
                          }}
                        />
                        <DeleteButton action={deleteTicket} id={tk.id} />
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
