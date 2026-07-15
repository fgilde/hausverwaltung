import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { CrudDialog } from "@/components/crud-dialog";
import { TextField, SelectField } from "@/components/form-fields";
import { createCost } from "@/server/actions/costs";

const COST_TYPES = [
  "GRUNDSTEUER", "WASSER", "ENTWAESSERUNG", "HEIZUNG", "WARMWASSER", "AUFZUG",
  "STRASSENREINIGUNG", "MUELL", "GEBAEUDEREINIGUNG", "GARTENPFLEGE", "BELEUCHTUNG",
  "SCHORNSTEIN", "VERSICHERUNG", "HAUSWART", "KABEL", "SONSTIGE",
];
const METHODS = ["AREA", "UNITS", "PERSONS", "CONSUMPTION", "MEA"];

export async function CostDialog({ propertyId, year }: { propertyId: string; year: number }) {
  const t = await getTranslations();
  const typeOpts = await getTranslations("costType").then((tt) =>
    COST_TYPES.map((k) => ({ value: k, label: tt(k) })),
  );
  const methodOpts = await getTranslations("allocationMethod").then((tt) =>
    METHODS.map((k) => ({ value: k, label: tt(k) })),
  );

  return (
    <CrudDialog
      trigger={
        <Button size="sm">
          <Plus className="size-4" />
          {t("statements.addCost")}
        </Button>
      }
      title={t("statements.addCost")}
      action={createCost}
      submitLabel={t("common.create")}
    >
      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="year" value={year} />
      <SelectField name="type" label={t("fields.type")} options={typeOpts} />
      <TextField name="amount" label={t("fields.amount")} type="number" step="0.01" />
      <SelectField name="method" label={t("statements.method")} options={methodOpts} />
      <SelectField
        name="umlagefaehig"
        label={t("statements.umlagefaehig")}
        defaultValue="true"
        options={[
          { value: "true", label: t("common.yes") },
          { value: "false", label: t("common.no") },
        ]}
      />
      <TextField name="note" label={t("rentComponent.note")} required={false} />
    </CrudDialog>
  );
}
