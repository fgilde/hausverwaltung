import { Plus, Pencil } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { CrudDialog } from "@/components/crud-dialog";
import { TextField, SelectField, TextAreaField } from "@/components/form-fields";
import { createTemplate, updateTemplate } from "@/server/actions/templates";

const CATS = ["ANSCHREIBEN", "ABRECHNUNG", "MAHNUNG", "VERTRAG", "PROTOKOLL", "SONSTIGES"];

type TemplateData = {
  id: string;
  category: string;
  name: string;
  subject: string | null;
  body: string;
};

export async function TemplateDialog({ template }: { template?: TemplateData }) {
  const t = await getTranslations();
  const edit = !!template;
  const catOpts = await getTranslations("templateCategory").then((tt) =>
    CATS.map((k) => ({ value: k, label: tt(k) })),
  );
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
            {t("templates.new")}
          </Button>
        )
      }
      title={edit ? t("templates.edit") : t("templates.new")}
      action={edit ? updateTemplate : createTemplate}
      submitLabel={edit ? t("common.save") : t("common.create")}
    >
      {edit && <input type="hidden" name="id" value={template!.id} />}
      <div className="grid grid-cols-2 gap-4">
        <SelectField name="category" label={t("templates.category")} defaultValue={template?.category ?? "ANSCHREIBEN"} options={catOpts} />
        <TextField name="name" label={t("fields.name")} defaultValue={template?.name} />
      </div>
      <TextField name="subject" label={t("templates.subject")} required={false} defaultValue={template?.subject ?? undefined} />
      <TextAreaField name="body" label={t("templates.body")} required defaultValue={template?.body} rows={8} />
    </CrudDialog>
  );
}
