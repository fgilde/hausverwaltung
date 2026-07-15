import { Upload } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { CrudDialog } from "@/components/crud-dialog";
import { TextField, SelectField } from "@/components/form-fields";
import { uploadDocument } from "@/server/actions/documents";

type Opt = { value: string; label: string };
const CATS = ["VERTRAG", "RECHNUNG", "ERECHNUNG", "PROTOKOLL", "ABRECHNUNG", "SONSTIGES"];

export async function DocumentDialog({
  properties,
  units,
  persons,
}: {
  properties: Opt[];
  units: Opt[];
  persons: Opt[];
}) {
  const t = await getTranslations();
  const catOpts = await getTranslations("documentCategory").then((tt) =>
    CATS.map((k) => ({ value: k, label: tt(k) })),
  );
  return (
    <CrudDialog
      trigger={
        <Button size="sm">
          <Upload className="size-4" />
          {t("documents.upload")}
        </Button>
      }
      title={t("documents.upload")}
      action={uploadDocument}
      submitLabel={t("documents.upload")}
    >
      <TextField name="file" label={t("documents.file")} type="file" />
      <TextField name="name" label={t("fields.name")} required={false} />
      <SelectField name="category" label={t("documents.category")} options={catOpts} defaultValue="SONSTIGES" />
      <SelectField
        name="propertyId"
        label={t("documents.property")}
        options={[{ value: "", label: t("documents.allProperties") }, ...properties]}
      />
      <SelectField
        name="unitId"
        label={t("documents.unit")}
        options={[{ value: "", label: t("common.none") }, ...units]}
      />
      <SelectField
        name="personId"
        label={t("documents.person")}
        options={[{ value: "", label: t("common.none") }, ...persons]}
      />
    </CrudDialog>
  );
}
