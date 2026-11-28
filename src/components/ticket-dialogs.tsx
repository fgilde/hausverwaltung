import { Plus, Pencil } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { CrudDialog } from "@/components/crud-dialog";
import { TextField, SelectField, TextAreaField } from "@/components/form-fields";
import {
  createTicket,
  updateTicket,
  createContractor,
  updateContractor,
  createMaintenance,
  updateMaintenance,
} from "@/server/actions/maintenance";

type Opt = { value: string; label: string };
const today = () => new Date().toISOString().slice(0, 10);
const iso = (d?: Date | null) => (d ? d.toISOString().slice(0, 10) : undefined);

async function opts(ns: string, keys: string[]): Promise<Opt[]> {
  const t = await getTranslations(ns);
  return keys.map((k) => ({ value: k, label: t(k) }));
}

type TicketData = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  propertyId: string | null;
  unitId: string | null;
  contractorId: string | null;
  assigneeId: string | null;
  dueDate: Date | null;
  reminderDate: Date | null;
  visitAt?: Date | null;
  /** aus dem Mieterportal gemeldet: Melder bekommt Nachricht und Termin (#100) */
  hasReporter?: boolean;
};

const dtLocal = (d?: Date | null) => (d ? d.toISOString().slice(0, 16) : undefined);

export async function TicketDialog({
  properties,
  units,
  contractors,
  users,
  ticket,
}: {
  properties: Opt[];
  units: Opt[];
  contractors: Opt[];
  users: Opt[];
  ticket?: TicketData;
}) {
  const t = await getTranslations();
  const edit = !!ticket;
  const prioOpts = await opts("ticketPriority", ["NIEDRIG", "MITTEL", "HOCH"]);
  const statusOpts = await opts("ticketStatus", ["OFFEN", "IN_ARBEIT", "WARTEND", "ERLEDIGT"]);
  const catOpts = await opts("ticketCategory", ["STOERUNG", "SCHADEN", "WARTUNG", "RECHNUNG", "VERTRAG", "SONSTIGES"]);
  const none = (arr: Opt[], label: string) => [{ value: "", label }, ...arr];

  return (
    <CrudDialog
      trigger={
        edit ? (
          <Button variant="ghost" size="icon" aria-label={t("common.edit")} title={t("common.edit")}>
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="size-4" />
            {t("tickets.new")}
          </Button>
        )
      }
      title={edit ? t("tickets.edit") : t("tickets.new")}
      action={edit ? updateTicket : createTicket}
      submitLabel={edit ? t("common.save") : t("common.create")}
    >
      {edit && <input type="hidden" name="id" value={ticket!.id} />}
      <TextField name="title" label={t("fields.name")} defaultValue={ticket?.title} />
      <TextAreaField name="description" label={t("rentComponent.note")} defaultValue={ticket?.description ?? undefined} />
      <div className="grid grid-cols-2 gap-4">
        <SelectField name="category" label={t("tickets.category")} defaultValue={ticket?.category ?? "SONSTIGES"} options={catOpts} />
        <SelectField name="priority" label={t("tickets.priority")} defaultValue={ticket?.priority ?? "MITTEL"} options={prioOpts} />
      </div>
      {edit && (
        <SelectField name="status" label={t("tickets.status")} defaultValue={ticket!.status} options={statusOpts} />
      )}
      <div className="grid grid-cols-2 gap-4">
        <TextField name="dueDate" label={t("tickets.dueDate")} type="date" required={false} defaultValue={iso(ticket?.dueDate)} />
        <TextField name="reminderDate" label={t("tickets.reminder")} type="date" required={false} defaultValue={iso(ticket?.reminderDate)} />
      </div>
      {edit && (
        <TextField name="visitAt" label={t("tickets.visitAt")} type="datetime-local" required={false} defaultValue={dtLocal(ticket?.visitAt)} />
      )}
      {ticket?.hasReporter && (
        <>
          <TextAreaField name="reporterMessage" label={t("tickets.reporterMessage")} required={false} />
          <p className="text-xs text-muted-foreground">{t("tickets.reporterHint")}</p>
        </>
      )}
      <SelectField name="assigneeId" label={t("tickets.assignee")} defaultValue={ticket?.assigneeId ?? ""} options={none(users, t("tickets.unassigned"))} />
      <SelectField name="propertyId" label={t("tickets.property")} defaultValue={ticket?.propertyId ?? ""} options={none(properties, t("common.none"))} />
      <SelectField name="unitId" label={t("tickets.unit")} defaultValue={ticket?.unitId ?? ""} options={none(units, t("common.none"))} />
      <SelectField name="contractorId" label={t("tickets.contractor")} defaultValue={ticket?.contractorId ?? ""} options={none(contractors, t("tickets.unassigned"))} />
    </CrudDialog>
  );
}

function EditTrigger({ label }: { label: string }) {
  return (
    <Button variant="ghost" size="icon" aria-label={label} title={label}>
      <Pencil className="size-4" />
    </Button>
  );
}

export async function ContractorDialog({
  contractor,
}: {
  /** vorhandener Handwerker: Bearbeiten (#97) */
  contractor?: { id: string; name: string; trade: string; email: string | null; phone: string | null };
} = {}) {
  const t = await getTranslations();
  return (
    <CrudDialog
      trigger={
        contractor ? (
          <EditTrigger label={t("common.edit")} />
        ) : (
          <Button size="sm" variant="outline">
            <Plus className="size-4" />
            {t("tickets.newContractor")}
          </Button>
        )
      }
      title={contractor ? t("tickets.editContractor") : t("tickets.newContractor")}
      action={contractor ? updateContractor : createContractor}
      submitLabel={contractor ? t("common.save") : t("common.create")}
    >
      {contractor && <input type="hidden" name="id" value={contractor.id} />}
      <TextField name="name" label={t("fields.name")} defaultValue={contractor?.name} />
      <TextField name="trade" label={t("tickets.trade")} defaultValue={contractor?.trade} />
      <TextField name="email" label={t("fields.email")} type="email" required={false} defaultValue={contractor?.email ?? undefined} />
      <TextField name="phone" label={t("fields.phone")} required={false} defaultValue={contractor?.phone ?? undefined} />
    </CrudDialog>
  );
}

export async function MaintenanceDialog({
  properties,
  contractors,
  contract,
}: {
  properties: Opt[];
  contractors: Opt[];
  /** vorhandener Wartungsvertrag: Bearbeiten (#97) */
  contract?: { id: string; title: string; propertyId: string; contractorId: string | null; intervalMonths: number; nextDue: Date; note: string | null };
}) {
  const t = await getTranslations();
  return (
    <CrudDialog
      trigger={
        contract ? (
          <EditTrigger label={t("common.edit")} />
        ) : (
          <Button size="sm" variant="outline">
            <Plus className="size-4" />
            {t("tickets.newMaintenance")}
          </Button>
        )
      }
      title={contract ? t("tickets.editMaintenance") : t("tickets.newMaintenance")}
      action={contract ? updateMaintenance : createMaintenance}
      submitLabel={contract ? t("common.save") : t("common.create")}
    >
      {contract && <input type="hidden" name="id" value={contract.id} />}
      <TextField name="title" label={t("fields.name")} defaultValue={contract?.title} />
      <SelectField name="propertyId" label={t("tickets.property")} options={properties} defaultValue={contract?.propertyId} />
      <SelectField
        name="contractorId"
        label={t("tickets.contractor")}
        options={[{ value: "", label: t("tickets.unassigned") }, ...contractors]}
        defaultValue={contract?.contractorId ?? ""}
      />
      <div className="grid grid-cols-2 gap-4">
        <TextField name="intervalMonths" label={t("tickets.interval")} type="number" defaultValue={contract?.intervalMonths ?? 12} />
        <TextField name="nextDue" label={t("tickets.nextDue")} type="date" defaultValue={iso(contract?.nextDue) ?? today()} />
      </div>
      <TextField name="note" label={t("rentComponent.note")} required={false} defaultValue={contract?.note ?? undefined} />
    </CrudDialog>
  );
}
