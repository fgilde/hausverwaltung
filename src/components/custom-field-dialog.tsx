import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { CrudDialog } from "@/components/crud-dialog";
import { TextField, SelectField } from "@/components/form-fields";
import { createCustomFieldDef } from "@/server/actions/custom-fields";

export async function CustomFieldDialog() {
  const t = await getTranslations();
  const entOpts = await getTranslations("customFieldEntity").then((tt) =>
    ["PROPERTY", "UNIT", "PERSON", "LEASE"].map((k) => ({ value: k, label: tt(k) })),
  );
  return (
    <CrudDialog
      trigger={
        <Button size="sm">
          <Plus className="size-4" />
          {t("customFields.new")}
        </Button>
      }
      title={t("customFields.new")}
      action={createCustomFieldDef}
      submitLabel={t("common.create")}
    >
      <SelectField name="entity" label={t("customFields.entity")} defaultValue="PROPERTY" options={entOpts} />
      <TextField name="key" label={t("customFields.key")} />
      <TextField name="label" label={t("customFields.label")} />
    </CrudDialog>
  );
}
