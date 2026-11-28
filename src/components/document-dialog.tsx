import { Upload, Pencil, Paperclip, FileText } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { CrudDialog } from "@/components/crud-dialog";
import { TextField, SelectField } from "@/components/form-fields";
import { uploadDocument, updateDocument } from "@/server/actions/documents";
import { DOCUMENT_CATEGORIES as CATS } from "@/lib/schemas";

type Opt = { value: string; label: string };

type DocData = {
  id: string;
  name: string;
  category: string;
  propertyId: string | null;
  unitId: string | null;
  personId: string | null;
  link?: string; // Vorgang "<art>:<id>" (#99)
};

export async function DocumentDialog({
  properties,
  units,
  persons,
  doc,
  links = [],
  preset,
}: {
  properties: Opt[];
  units: Opt[];
  persons: Opt[];
  doc?: DocData; // gesetzt = Bearbeiten statt Hochladen
  /** Vorgänge zur Auswahl (#99) */
  links?: Opt[];
  /** Hochladen direkt am Vorgang (#99): Zuordnung fest, nur Datei/Name/Kategorie */
  preset?: { link: string; propertyId?: string | null; unitId?: string | null; personId?: string | null; category?: string };
}) {
  const t = await getTranslations();
  const catOpts = await getTranslations("documentCategory").then((tt) =>
    CATS.map((k) => ({ value: k, label: tt(k) })),
  );
  const edit = !!doc;
  return (
    <CrudDialog
      trigger={
        preset ? (
          <Button variant="ghost" size="icon" aria-label={t("documents.uploadHere")} title={t("documents.uploadHere")}>
            <Paperclip className="size-4" />
          </Button>
        ) : edit ? (
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
        defaultValue={doc?.category ?? preset?.category ?? "SONSTIGES"}
      />
      {preset ? (
        <>
          <input type="hidden" name="link" value={preset.link} />
          <input type="hidden" name="propertyId" value={preset.propertyId ?? ""} />
          <input type="hidden" name="unitId" value={preset.unitId ?? ""} />
          <input type="hidden" name="personId" value={preset.personId ?? ""} />
        </>
      ) : (
        <>
          {links.length > 0 && (
            <SelectField
              name="link"
              label={t("documents.link")}
              options={[{ value: "", label: t("common.none") }, ...links]}
              defaultValue={doc?.link ?? ""}
            />
          )}
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
        </>
      )}
    </CrudDialog>
  );
}

/**
 * Dokumente eines Vorgangs (#99): Anzahl mit Link auf die gefilterte Dokumentenliste
 * und Hochladen direkt mit fester Zuordnung.
 */
export async function LinkedDocs({
  link,
  count,
  preset,
}: {
  link: string;
  count: number;
  preset?: { propertyId?: string | null; unitId?: string | null; personId?: string | null; category?: string };
}) {
  const t = await getTranslations();
  return (
    <span className="inline-flex items-center">
      {count > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 px-2"
          title={t("documents.linkedCount", { count })}
          render={<Link href={`/documents?link=${encodeURIComponent(link)}`} />}
        >
          <FileText className="size-4" />
          {count}
        </Button>
      )}
      <DocumentDialog properties={[]} units={[]} persons={[]} preset={{ link, ...preset }} />
    </span>
  );
}
