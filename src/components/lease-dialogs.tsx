import { Plus, Pencil } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { CrudDialog } from "@/components/crud-dialog";
import { TextField, SelectField } from "@/components/form-fields";
import {
  createLease,
  updateLease,
  createComponent,
  createAdjustment,
  upsertDeposit,
  addRenter,
} from "@/server/actions/leases";

type Opt = { value: string; label: string };
const iso = (d?: Date | null) => (d ? d.toISOString().slice(0, 10) : undefined);

async function opts(ns: string, keys: string[]): Promise<Opt[]> {
  const t = await getTranslations(ns);
  return keys.map((k) => ({ value: k, label: t(k) }));
}

function CreateTrigger({ label, variant }: { label: string; variant?: "outline" }) {
  return (
    <Button size="sm" variant={variant}>
      <Plus className="size-4" />
      {label}
    </Button>
  );
}

type LeaseData = {
  id: string;
  startDate: Date;
  endDate: Date | null;
  rentCold: string;
  personCount: number;
  noticePeriodM: number | null;
};

export async function LeaseDialog({
  units,
  persons,
  lease,
}: {
  units?: Opt[];
  persons?: Opt[];
  lease?: LeaseData;
}) {
  const t = await getTranslations();
  const edit = !!lease;
  return (
    <CrudDialog
      trigger={
        edit ? (
          <Button variant="ghost" size="icon" aria-label={t("common.edit")}>
            <Pencil className="size-4" />
          </Button>
        ) : (
          <CreateTrigger label={t("leases.new")} />
        )
      }
      title={edit ? t("leases.edit") : t("leases.new")}
      action={edit ? updateLease : createLease}
      submitLabel={edit ? t("common.save") : t("common.create")}
    >
      {edit ? (
        <input type="hidden" name="id" value={lease!.id} />
      ) : (
        <>
          <SelectField name="unitId" label={t("leases.selectUnit")} options={units ?? []} />
          <SelectField name="personId" label={t("leases.selectPerson")} options={persons ?? []} />
        </>
      )}
      <div className="grid grid-cols-2 gap-4">
        <TextField name="startDate" label={t("leases.start")} type="date" defaultValue={iso(lease?.startDate)} />
        <TextField
          name="endDate"
          label={t("leases.end")}
          type="date"
          required={false}
          defaultValue={iso(lease?.endDate)}
        />
      </div>
      <TextField
        name="rentCold"
        label={t("leases.coldRent")}
        type="number"
        step="0.01"
        defaultValue={lease?.rentCold}
      />
      <div className="grid grid-cols-2 gap-4">
        <TextField
          name="personCount"
          label={t("leases.personCount")}
          type="number"
          defaultValue={lease?.personCount ?? 1}
        />
        <TextField
          name="noticePeriodM"
          label={t("leases.noticePeriod")}
          type="number"
          required={false}
          defaultValue={lease?.noticePeriodM ?? undefined}
        />
      </div>
    </CrudDialog>
  );
}

export async function ComponentDialog({ leaseId }: { leaseId: string }) {
  const t = await getTranslations();
  return (
    <CrudDialog
      trigger={<CreateTrigger label={t("rentComponent.new")} variant="outline" />}
      title={t("rentComponent.new")}
      action={createComponent}
      submitLabel={t("common.create")}
    >
      <input type="hidden" name="leaseId" value={leaseId} />
      <SelectField
        name="type"
        label={t("fields.type")}
        options={await opts("rentComponentType", [
          "NEBENKOSTEN",
          "HEIZKOSTEN",
          "STELLPLATZ",
          "MODERNISIERUNG",
          "SONSTIGES",
        ])}
      />
      <TextField name="amount" label={t("fields.value")} type="number" step="0.01" />
      <TextField name="note" label={t("rentComponent.note")} required={false} />
    </CrudDialog>
  );
}

export async function AdjustmentDialog({ leaseId }: { leaseId: string }) {
  const t = await getTranslations();
  return (
    <CrudDialog
      trigger={<CreateTrigger label={t("adjustment.new")} variant="outline" />}
      title={t("adjustment.new")}
      action={createAdjustment}
      submitLabel={t("common.create")}
    >
      <input type="hidden" name="leaseId" value={leaseId} />
      <SelectField
        name="type"
        label={t("fields.type")}
        options={await opts("adjustmentType", ["STAFFEL", "INDEX"])}
      />
      <TextField name="effectiveDate" label={t("adjustment.effectiveDate")} type="date" />
      <TextField name="newRentCold" label={t("adjustment.newRent")} type="number" step="0.01" />
      <div className="grid grid-cols-2 gap-4">
        <TextField name="indexBase" label={t("adjustment.indexBase")} type="number" step="0.01" required={false} />
        <TextField name="indexNew" label={t("adjustment.indexNew")} type="number" step="0.01" required={false} />
      </div>
    </CrudDialog>
  );
}

type DepositData = {
  id: string;
  type: string;
  amount: string;
  receivedDate: Date | null;
};

export async function DepositDialog({
  leaseId,
  deposit,
}: {
  leaseId: string;
  deposit?: DepositData;
}) {
  const t = await getTranslations();
  const edit = !!deposit;
  return (
    <CrudDialog
      trigger={<CreateTrigger label={edit ? t("deposit.edit") : t("deposit.set")} variant="outline" />}
      title={edit ? t("deposit.edit") : t("deposit.set")}
      action={upsertDeposit}
      submitLabel={t("common.save")}
    >
      <input type="hidden" name="leaseId" value={leaseId} />
      <SelectField
        name="type"
        label={t("fields.type")}
        defaultValue={deposit?.type ?? "BAR"}
        options={await opts("depositType", ["BAR", "BUERGSCHAFT", "VERPFAENDET", "KAUTIONSKONTO"])}
      />
      <TextField name="amount" label={t("fields.value")} type="number" step="0.01" defaultValue={deposit?.amount} />
      <TextField
        name="receivedDate"
        label={t("deposit.receivedDate")}
        type="date"
        required={false}
        defaultValue={iso(deposit?.receivedDate)}
      />
    </CrudDialog>
  );
}

export async function RenterDialog({ leaseId, persons }: { leaseId: string; persons: Opt[] }) {
  const t = await getTranslations();
  return (
    <CrudDialog
      trigger={<CreateTrigger label={t("renter.add")} variant="outline" />}
      title={t("renter.add")}
      action={addRenter}
      submitLabel={t("common.add")}
    >
      <input type="hidden" name="leaseId" value={leaseId} />
      <SelectField name="personId" label={t("leases.selectPerson")} options={persons} />
    </CrudDialog>
  );
}
