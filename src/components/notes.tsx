import { Pencil, Pin, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CrudDialog } from "@/components/crud-dialog";
import { TextField, SelectField } from "@/components/form-fields";
import { RichTextEditor } from "@/components/rich-text-editor";
import { DeleteButton } from "@/components/delete-button";
import { LinkedDocs } from "@/components/document-dialog";
import { createNote, updateNote, deleteNote } from "@/server/actions/notes";
import { dateTime } from "@/lib/format";

// Zentrale Notizen (#89): Dialog und Kartenliste, genutzt auf /notes und bei Objekt,
// Einheit und Person.

type Opt = { value: string; label: string };

export type NoteData = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  propertyId: string | null;
  unitId: string | null;
  personId: string | null;
  author: string | null;
  updatedAt: Date;
  /** Anzeige der Zuordnung, z. B. „Lindenstraße · EG links“ */
  linked?: string;
  documentCount?: number;
};

export async function NoteDialog({
  note,
  properties = [],
  units = [],
  persons = [],
  preset,
}: {
  note?: NoteData;
  properties?: Opt[];
  units?: Opt[];
  persons?: Opt[];
  /** von Objekt/Einheit/Person aus: Zuordnung fest */
  preset?: { propertyId?: string | null; unitId?: string | null; personId?: string | null };
}) {
  const t = await getTranslations();
  const edit = !!note;
  const fixed = preset ?? (edit && properties.length === 0 ? note : undefined);
  return (
    <CrudDialog
      trigger={
        edit ? (
          <Button variant="ghost" size="icon" aria-label={t("common.edit")} title={t("common.edit")}>
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button size="sm" variant={preset ? "outline" : "default"}>
            <Plus className="size-4" />
            {t("notes.new")}
          </Button>
        )
      }
      title={edit ? t("notes.edit") : t("notes.new")}
      action={edit ? updateNote : createNote}
      submitLabel={edit ? t("common.save") : t("common.create")}
    >
      {edit && <input type="hidden" name="id" value={note!.id} />}
      <TextField name="title" label={t("notes.titleField")} defaultValue={note?.title} />
      <div className="space-y-2">
        <label htmlFor="noteBody" className="text-sm font-medium">{t("notes.body")}</label>
        <RichTextEditor id="noteBody" name="body" initialHtml={note?.body ?? ""} />
      </div>
      {fixed ? (
        <>
          <input type="hidden" name="propertyId" value={fixed.propertyId ?? ""} />
          <input type="hidden" name="unitId" value={fixed.unitId ?? ""} />
          <input type="hidden" name="personId" value={fixed.personId ?? ""} />
        </>
      ) : (
        <>
          <SelectField name="propertyId" label={t("documents.property")} options={[{ value: "", label: t("common.none") }, ...properties]} defaultValue={note?.propertyId ?? ""} />
          <SelectField name="unitId" label={t("documents.unit")} options={[{ value: "", label: t("common.none") }, ...units]} defaultValue={note?.unitId ?? ""} />
          <SelectField name="personId" label={t("documents.person")} options={[{ value: "", label: t("common.none") }, ...persons]} defaultValue={note?.personId ?? ""} />
        </>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="pinned" defaultChecked={note?.pinned} className="size-4" />
        {t("notes.pinned")}
      </label>
    </CrudDialog>
  );
}

/** Notizen als Karten; Text ist beim Speichern bereinigtes HTML. */
export async function NoteCards({
  notes,
  canWrite,
  options,
}: {
  notes: NoteData[];
  canWrite: boolean;
  /** Auswahllisten fürs Bearbeiten; leer = Zuordnung bleibt wie sie ist */
  options?: { properties: Opt[]; units: Opt[]; persons: Opt[] };
}) {
  const t = await getTranslations();
  if (notes.length === 0) return <p className="text-sm text-muted-foreground">{t("notes.empty")}</p>;
  return (
    <div className="space-y-3">
      {notes.map((n) => (
        <div key={n.id} className="rounded-lg border p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 font-medium">
                {n.pinned && <Pin className="size-3.5 shrink-0 text-primary" aria-label={t("notes.pinned")} />}
                <span className="truncate">{n.title}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {dateTime(n.updatedAt)}
                {n.author ? ` · ${n.author}` : ""}
                {n.linked ? (
                  <>
                    {" · "}
                    <Badge variant="outline" className="align-middle">{n.linked}</Badge>
                  </>
                ) : null}
              </div>
            </div>
            {canWrite && (
              <div className="flex shrink-0 items-center">
                <LinkedDocs link={`note:${n.id}`} count={n.documentCount ?? 0} preset={{ propertyId: n.propertyId, unitId: n.unitId, personId: n.personId }} />
                <NoteDialog note={n} {...(options ?? {})} />
                <DeleteButton action={deleteNote} id={n.id} />
              </div>
            )}
          </div>
          {n.body && (
            // HTML wurde beim Speichern mit sanitize-html bereinigt
            <div className="mail-html mt-2 text-sm" dangerouslySetInnerHTML={{ __html: n.body }} />
          )}
        </div>
      ))}
    </div>
  );
}
