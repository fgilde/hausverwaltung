import { getTranslations } from "next-intl/server";
import { CrudDialog } from "@/components/crud-dialog";
import { TextField, SelectField } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Plus, Pencil } from "lucide-react";
import { createAreaAllocation, updateAreaAllocation } from "@/server/actions/area";

type Opt = { value: string; label: string };
const iso = (d?: Date | null) => (d ? d.toISOString().slice(0, 10) : undefined);

type AreaData = {
  id: string;
  leaseId: string | null;
  personId: string | null;
  label: string | null;
  area: string;
  pricePerSqm: string | null;
  outdoor: boolean;
  from: Date;
  to: Date | null;
};

export async function AreaAllocationDialog({
  propertyId,
  leases,
  persons,
  allocation,
}: {
  propertyId: string;
  leases: Opt[];
  persons: Opt[];
  allocation?: AreaData;
}) {
  const t = await getTranslations();
  const edit = !!allocation;
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
            {t("areaModel.add")}
          </Button>
        )
      }
      title={edit ? t("areaModel.edit") : t("areaModel.add")}
      action={edit ? updateAreaAllocation : createAreaAllocation}
      submitLabel={edit ? t("common.save") : t("common.create")}
    >
      <input type="hidden" name="propertyId" value={propertyId} />
      {edit && <input type="hidden" name="id" value={allocation!.id} />}
      <TextField name="label" label={t("areaModel.label")} required={false} defaultValue={allocation?.label ?? undefined} />
      <SelectField
        name="personId"
        label={t("areaModel.person")}
        defaultValue={allocation?.personId ?? ""}
        options={[{ value: "", label: t("areaModel.vacancy") }, ...persons]}
      />
      <SelectField
        name="leaseId"
        label={t("areaModel.lease")}
        defaultValue={allocation?.leaseId ?? ""}
        options={[{ value: "", label: t("common.none") }, ...leases]}
      />
      <div className="grid grid-cols-2 gap-4">
        <TextField name="area" label={t("areaModel.area")} type="number" step="0.01" defaultValue={allocation?.area} />
        <TextField
          name="pricePerSqm"
          label={t("areaModel.pricePerSqm")}
          type="number"
          step="0.01"
          required={false}
          defaultValue={allocation?.pricePerSqm ?? undefined}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <TextField name="from" label={t("areaModel.from")} type="date" defaultValue={iso(allocation?.from)} />
        <TextField name="to" label={t("areaModel.to")} type="date" required={false} defaultValue={iso(allocation?.to)} />
      </div>
      <SelectField
        name="outdoor"
        label={t("areaModel.outdoor")}
        defaultValue={allocation?.outdoor ? "true" : "false"}
        options={[
          { value: "false", label: t("common.no") },
          { value: "true", label: t("common.yes") },
        ]}
      />
    </CrudDialog>
  );
}
