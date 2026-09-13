import { Upload, Pencil } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { CrudDialog } from "@/components/crud-dialog";
import { TextField, SelectField } from "@/components/form-fields";
import { uploadDocument, updateDocument } from "@/server/actions/documents";

type Opt = { value: string; label: string };
const CATS = ["VERTRAG", "RECHNUNG", "ERECHNUNG", "PROTOKOLL", "ABRECHNUNG", "SONSTIGES"];

type DocData = {
  id: string;
  name: string;
  category: string;
  propertyId: string | null;
  unitId: string | null;
  personId: string | null;
};

export async function DocumentDialog({
  properties,
  units,
  persons,
  doc,
}: {
  properties: Opt[];
  units: Opt[];
  persons: Opt[];
  doc?: DocData; // gesetzt = Bearbeiten statt Hochladen
}) {
  const t = await getTranslations();
  const catOpts = await getTranslations("documentCategory").then((tt) =>
    CATS.map((k) => ({ value: k, label: tt(k) })),
  );
  const edit = !!doc;
  return (
    <CrudDialog
      trigger={
        edit ? (
          <Button variant="ghost" size="icon" aria-label={t("common.edit")} title={t("common.edit")}>
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button size="sm">
            <Upload className="size-4" />
            {t("documents.upload")}
          </Button>
        )
      }
      title={edit ? t("documents.edit") : t("documents.upload")}
      action={edit ? updateDocument : uploadDocument}
      submitLabel={edit ? t("common.save") : t("documents.upload")}
    >
      {edit ? (
        <input type="hidden" name="id" value={doc!.id} />
      ) : (
        <TextField name="file" label={t("documents.file")} type="file" />
      )}
      <TextField name="name" label={t("fields.name")} required={edit} defaultValue={doc?.name} />
      <SelectField
        name="category"
        label={t("documents.category")}
        options={catOpts}
        defaultValue={doc?.category ?? "SONSTIGES"}
      />
      <SelectField
        name="propertyId"
        label={t("documents.property")}
        options={[{ value: "", label: t("documents.allProperties") }, ...properties]}
        defaultValue={doc?.propertyId ?? ""}
      />
      <SelectField
        name="unitId"
        label={t("documents.unit")}
        options={[{ value: "", label: t("common.none") }, ...units]}
        defaultValue={doc?.unitId ?? ""}
      />
      <SelectField
        name="personId"
        label={t("documents.person")}
        options={[{ value: "", label: t("common.none") }, ...persons]}
        defaultValue={doc?.personId ?? ""}
      />
    </CrudDialog>
  );
}
