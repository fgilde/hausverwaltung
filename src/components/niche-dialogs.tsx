import { Plus, Pencil } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { CrudDialog } from "@/components/crud-dialog";
import { TextField, SelectField } from "@/components/form-fields";
import { createInsurance, upsertPropertyTax } from "@/server/actions/niche";

type Opt = { value: string; label: string };
const today = () => new Date().toISOString().slice(0, 10);
const INS_TYPES = ["GEBAEUDE", "HAFTPFLICHT", "GLAS", "ELEMENTAR", "RECHTSSCHUTZ", "SONSTIGES"];

export async function InsuranceDialog({ properties }: { properties: Opt[] }) {
  const t = await getTranslations();
  const typeOpts = await getTranslations("insuranceType").then((tt) =>
    INS_TYPES.map((k) => ({ value: k, label: tt(k) })),
  );
  return (
    <CrudDialog
      trigger={
        <Button size="sm">
          <Plus className="size-4" />
          {t("insurance.new")}
        </Button>
      }
      title={t("insurance.new")}
      action={createInsurance}
      submitLabel={t("common.create")}
    >
      <SelectField name="propertyId" label={t("units.property")} options={properties} />
      <SelectField name="type" label={t("fields.type")} defaultValue="GEBAEUDE" options={typeOpts} />
      <TextField name="insurer" label={t("insurance.insurer")} />
      <div className="grid grid-cols-2 gap-4">
        <TextField name="policyNo" label={t("insurance.policyNo")} required={false} />
        <TextField name="premium" label={t("insurance.premium")} type="number" step="0.01" defaultValue={0} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <TextField name="startDate" label={t("insurance.start")} type="date" required={false} defaultValue={today()} />
        <TextField name="endDate" label={t("insurance.end")} type="date" required={false} />
      </div>
      <TextField name="note" label={t("rentComponent.note")} required={false} />
    </CrudDialog>
  );
}

type TaxData = {
  aktenzeichen: string | null;
  grundsteuerwert: string | null;
  messbetrag: string | null;
  hebesatz: string | null;
  note: string | null;
};

export async function PropertyTaxDialog({
  propertyId,
  tax,
}: {
  propertyId: string;
  tax?: TaxData;
}) {
  const t = await getTranslations();
  return (
    <CrudDialog
      trigger={
        <Button variant="ghost" size="icon" aria-label={t("common.edit")} title={t("common.edit")}>
          <Pencil className="size-4" />
        </Button>
      }
      title={t("grundsteuer.edit")}
      action={upsertPropertyTax}
      submitLabel={t("common.save")}
    >
      <input type="hidden" name="propertyId" value={propertyId} />
      <TextField name="aktenzeichen" label={t("grundsteuer.aktenzeichen")} required={false} defaultValue={tax?.aktenzeichen ?? undefined} />
      <div className="grid grid-cols-2 gap-4">
        <TextField name="grundsteuerwert" label={t("grundsteuer.grundsteuerwert")} type="number" step="0.01" required={false} defaultValue={tax?.grundsteuerwert ?? undefined} />
        <TextField name="messbetrag" label={t("grundsteuer.messbetrag")} type="number" step="0.01" required={false} defaultValue={tax?.messbetrag ?? undefined} />
      </div>
      <TextField name="hebesatz" label={t("grundsteuer.hebesatz")} type="number" step="0.01" required={false} defaultValue={tax?.hebesatz ?? undefined} />
      <TextField name="note" label={t("rentComponent.note")} required={false} defaultValue={tax?.note ?? undefined} />
    </CrudDialog>
  );
}
