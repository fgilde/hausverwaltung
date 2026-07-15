import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { CrudDialog } from "@/components/crud-dialog";
import { TextField, SelectField } from "@/components/form-fields";
import {
  createOwner,
  upsertEconomicPlan,
  createReserve,
  createReserveTx,
} from "@/server/actions/weg";

type Opt = { value: string; label: string };
const today = () => new Date().toISOString().slice(0, 10);

function Trigger({ label, variant }: { label: string; variant?: "outline" }) {
  return (
    <Button size="sm" variant={variant}>
      <Plus className="size-4" />
      {label}
    </Button>
  );
}

export async function OwnerDialog({ units, persons }: { units: Opt[]; persons: Opt[] }) {
  const t = await getTranslations();
  return (
    <CrudDialog
      trigger={<Trigger label={t("weg.addOwner")} />}
      title={t("weg.addOwner")}
      action={createOwner}
      submitLabel={t("common.create")}
    >
      <SelectField name="personId" label={t("leases.selectPerson")} options={persons} />
      <SelectField name="unitId" label={t("leases.selectUnit")} options={units} />
      <TextField name="share" label={t("weg.share")} type="number" defaultValue={1000} />
    </CrudDialog>
  );
}

export async function PlanDialog({
  propertyId,
  year,
  plan,
}: {
  propertyId: string;
  year: number;
  plan?: { totalAmount: string; note: string | null };
}) {
  const t = await getTranslations();
  return (
    <CrudDialog
      trigger={<Trigger label={t("weg.setPlan")} variant="outline" />}
      title={t("weg.setPlan")}
      action={upsertEconomicPlan}
      submitLabel={t("common.save")}
    >
      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="year" value={year} />
      <TextField
        name="totalAmount"
        label={t("weg.planTotal")}
        type="number"
        step="0.01"
        defaultValue={plan?.totalAmount}
      />
      <TextField name="note" label={t("rentComponent.note")} required={false} defaultValue={plan?.note ?? undefined} />
    </CrudDialog>
  );
}

export async function ReserveDialog({ propertyId }: { propertyId: string }) {
  const t = await getTranslations();
  return (
    <CrudDialog
      trigger={<Trigger label={t("weg.addReserve")} variant="outline" />}
      title={t("weg.addReserve")}
      action={createReserve}
      submitLabel={t("common.create")}
    >
      <input type="hidden" name="propertyId" value={propertyId} />
      <TextField name="name" label={t("fields.name")} />
    </CrudDialog>
  );
}

export async function ReserveTxDialog({ reserveId }: { reserveId: string }) {
  const t = await getTranslations();
  return (
    <CrudDialog
      trigger={
        <Button variant="ghost" size="sm">
          <Plus className="size-4" />
          {t("weg.addTx")}
        </Button>
      }
      title={t("weg.addTx")}
      action={createReserveTx}
      submitLabel={t("common.create")}
    >
      <input type="hidden" name="reserveId" value={reserveId} />
      <TextField name="date" label={t("fields.date")} type="date" defaultValue={today()} />
      <TextField name="amount" label={t("fields.amount")} type="number" step="0.01" />
      <TextField name="note" label={t("rentComponent.note")} required={false} />
    </CrudDialog>
  );
}
