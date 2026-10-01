import { Plus, Pencil } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { CrudDialog } from "@/components/crud-dialog";
import { TextField, SelectField, MultiSelectField } from "@/components/form-fields";
import {
  createOwner,
  upsertEconomicPlan,
  createReserve,
  createReserveTx,
  createSubcommunity,
  updateSubcommunity,
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
      <TextField name="share" label={t("weg.share")} type="number" step="any" defaultValue={1000} />
    </CrudDialog>
  );
}

export async function PlanDialog({
  propertyId,
  year,
  plan,
  subcommunity,
}: {
  propertyId: string;
  year: number;
  plan?: { totalAmount: string; note: string | null };
  subcommunity?: { id: string; name: string }; // Plan einer Untergemeinschaft (#42)
}) {
  const t = await getTranslations();
  const title = subcommunity ? `${t("weg.setPlan")} · ${subcommunity.name}` : t("weg.setPlan");
  return (
    <CrudDialog
      trigger={<Trigger label={t("weg.setPlan")} variant="outline" />}
      title={title}
      action={upsertEconomicPlan}
      submitLabel={t("common.save")}
    >
      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="year" value={year} />
      {subcommunity && <input type="hidden" name="subcommunityId" value={subcommunity.id} />}
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

export async function ReserveDialog({ propertyId, subcommunities = [] }: { propertyId: string; subcommunities?: Opt[] }) {
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
      {subcommunities.length > 0 && <ScopeField subcommunities={subcommunities} label={t("weg.scope")} wholeLabel={t("weg.wholeCommunity")} />}
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

/** Auswahl „Gesamt-WEG“ oder eine Untergemeinschaft (#42). */
export function ScopeField({
  subcommunities,
  label,
  wholeLabel,
  defaultValue,
}: {
  subcommunities: Opt[];
  label: string;
  wholeLabel: string;
  defaultValue?: string | null;
}) {
  return (
    <SelectField
      name="subcommunityId"
      label={label}
      defaultValue={defaultValue ?? ""}
      options={[{ value: "", label: wholeLabel }, ...subcommunities]}
    />
  );
}

export async function SubcommunityDialog({
  propertyId,
  units,
  subcommunity,
}: {
  propertyId: string;
  units: Opt[];
  subcommunity?: { id: string; name: string; unitIds: string[] };
}) {
  const t = await getTranslations();
  const edit = !!subcommunity;
  return (
    <CrudDialog
      trigger={
        edit ? (
          <Button variant="ghost" size="icon" aria-label={t("common.edit")} title={t("common.edit")}>
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Trigger label={t("weg.addSubcommunity")} variant="outline" />
        )
      }
      title={edit ? t("weg.editSubcommunity") : t("weg.addSubcommunity")}
      action={edit ? updateSubcommunity : createSubcommunity}
      submitLabel={edit ? t("common.save") : t("common.create")}
    >
      {edit ? <input type="hidden" name="id" value={subcommunity!.id} /> : <input type="hidden" name="propertyId" value={propertyId} />}
      <TextField name="name" label={t("fields.name")} defaultValue={subcommunity?.name} />
      <MultiSelectField name="unitIds" label={t("weg.subcommunityUnits")} options={units} defaultValues={subcommunity?.unitIds} />
      <p className="text-xs text-muted-foreground">{t("weg.subcommunityHint")}</p>
    </CrudDialog>
  );
}
