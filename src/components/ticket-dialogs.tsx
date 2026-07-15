import { Plus, Pencil } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { CrudDialog } from "@/components/crud-dialog";
import { TextField, SelectField, TextAreaField } from "@/components/form-fields";
import {
  createTicket,
  updateTicket,
  createContractor,
  createMaintenance,
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
  priority: string;
  status: string;
  propertyId: string | null;
  unitId: string | null;
  contractorId: string | null;
};

export async function TicketDialog({
  properties,
  units,
  contractors,
  ticket,
}: {
  properties: Opt[];
  units: Opt[];
  contractors: Opt[];
  ticket?: TicketData;
}) {
  const t = await getTranslations();
  const edit = !!ticket;
  const prioOpts = await opts("ticketPriority", ["NIEDRIG", "MITTEL", "HOCH"]);
  const statusOpts = await opts("ticketStatus", ["OFFEN", "IN_ARBEIT", "ERLEDIGT"]);
  const none = (arr: Opt[], label: string) => [{ value: "", label }, ...arr];

  return (
    <CrudDialog
      trigger={
        edit ? (
          <Button variant="ghost" size="icon" aria-label={t("common.edit")}>
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
        <SelectField name="priority" label={t("tickets.priority")} defaultValue={ticket?.priority ?? "MITTEL"} options={prioOpts} />
        {edit && <SelectField name="status" label={t("tickets.status")} defaultValue={ticket!.status} options={statusOpts} />}
      </div>
      <SelectField name="propertyId" label={t("tickets.property")} defaultValue={ticket?.propertyId ?? ""} options={none(properties, t("common.none"))} />
      <SelectField name="unitId" label={t("tickets.unit")} defaultValue={ticket?.unitId ?? ""} options={none(units, t("common.none"))} />
      <SelectField name="contractorId" label={t("tickets.contractor")} defaultValue={ticket?.contractorId ?? ""} options={none(contractors, t("tickets.unassigned"))} />
    </CrudDialog>
  );
}

export async function ContractorDialog() {
  const t = await getTranslations();
  return (
    <CrudDialog
      trigger={
        <Button size="sm" variant="outline">
          <Plus className="size-4" />
          {t("tickets.newContractor")}
        </Button>
      }
      title={t("tickets.newContractor")}
      action={createContractor}
      submitLabel={t("common.create")}
    >
      <TextField name="name" label={t("fields.name")} />
      <TextField name="trade" label={t("tickets.trade")} />
      <TextField name="email" label={t("fields.email")} type="email" required={false} />
      <TextField name="phone" label={t("fields.phone")} required={false} />
    </CrudDialog>
  );
}

export async function MaintenanceDialog({
  properties,
  contractors,
}: {
  properties: Opt[];
  contractors: Opt[];
}) {
  const t = await getTranslations();
  return (
    <CrudDialog
      trigger={
        <Button size="sm" variant="outline">
          <Plus className="size-4" />
          {t("tickets.newMaintenance")}
        </Button>
      }
      title={t("tickets.newMaintenance")}
      action={createMaintenance}
      submitLabel={t("common.create")}
    >
      <TextField name="title" label={t("fields.name")} />
      <SelectField name="propertyId" label={t("tickets.property")} options={properties} />
      <SelectField
        name="contractorId"
        label={t("tickets.contractor")}
        options={[{ value: "", label: t("tickets.unassigned") }, ...contractors]}
      />
      <div className="grid grid-cols-2 gap-4">
        <TextField name="intervalMonths" label={t("tickets.interval")} type="number" defaultValue={12} />
        <TextField name="nextDue" label={t("tickets.nextDue")} type="date" defaultValue={today()} />
      </div>
      <TextField name="note" label={t("rentComponent.note")} required={false} />
    </CrudDialog>
  );
}
