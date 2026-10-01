"use client";

import { createContext, useContext } from "react";
import { useTranslations } from "next-intl";
import { FilePlus2, Paperclip } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CrudDialog } from "@/components/crud-dialog";
import { TextField, SelectField } from "@/components/form-fields";
import { DocumentPreview } from "@/components/document-preview";
import { importInboundAttachment } from "@/server/actions/inbound";
import { DOCUMENT_CATEGORIES } from "@/lib/schemas";
import { attachmentUrl, type MailAttachment } from "@/lib/mail-attachments";

type Opt = { value: string; label: string };
export type ImportOptions = { properties: Opt[]; units: Opt[]; persons: Opt[] };
export type ImportDefaults = { personId: string | null; propertyId: string | null; unitId: string | null };

// Auswahllisten einmal je Seite bereitstellen statt in jeder Mail-Zeile (#52).
const ImportCtx = createContext<ImportOptions | null>(null);
export function AttachmentImportProvider({ options, children }: { options: ImportOptions | null; children: React.ReactNode }) {
  return <ImportCtx.Provider value={options}>{children}</ImportCtx.Provider>;
}

/** Anhang als Dokument übernehmen, Kategorie/Kontakt/Objekt/Einheit vorbelegt (#51/#52). */
function ImportButton({ attachment, defaults }: { attachment: MailAttachment; defaults?: ImportDefaults }) {
  const t = useTranslations();
  const opts = useContext(ImportCtx);
  if (!opts) return null;
  const cats = DOCUMENT_CATEGORIES.map((k) => ({ value: k, label: t(`documentCategory.${k}`) }));
  return (
    <CrudDialog
      trigger={
        <Button variant="ghost" size="sm" title={t("email.importAttachment")}>
          <FilePlus2 className="size-4" />
          {t("email.import")}
        </Button>
      }
      title={t("email.importAttachment")}
      action={importInboundAttachment}
      submitLabel={t("email.import")}
    >
      <input type="hidden" name="attachmentId" value={attachment.id} />
      <TextField name="name" label={t("fields.name")} defaultValue={attachment.name} />
      <SelectField name="category" label={t("documents.category")} options={cats} defaultValue="EMAIL_ANHANG" />
      <SelectField
        name="personId"
        label={t("documents.person")}
        options={[{ value: "", label: t("common.none") }, ...opts.persons]}
        defaultValue={defaults?.personId ?? ""}
      />
      <SelectField
        name="propertyId"
        label={t("documents.property")}
        options={[{ value: "", label: t("documents.allProperties") }, ...opts.properties]}
        defaultValue={defaults?.propertyId ?? ""}
      />
      <SelectField
        name="unitId"
        label={t("documents.unit")}
        options={[{ value: "", label: t("common.none") }, ...opts.units]}
        defaultValue={defaults?.unitId ?? ""}
      />
    </CrudDialog>
  );
}

/** Anhänge einer Mail: Vorschau, Download und (eingehend) übernehmen. */
export function MailAttachmentList({
  attachments,
  defaults,
  inbound,
}: {
  attachments: MailAttachment[];
  defaults?: ImportDefaults;
  inbound?: boolean;
}) {
  const t = useTranslations();
  if (attachments.length === 0) return null;
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-sm font-medium">
        <Paperclip className="size-4" /> {t("email.attachmentsShort")}
      </div>
      {attachments.map((a) => {
        const pending = inbound && !a.documentId;
        return (
          <div key={a.id} className="flex items-center gap-1 rounded px-1 py-0.5 text-sm hover:bg-muted">
            <DocumentPreview id={a.documentId ?? a.id} name={a.name} mime={a.mime} attachment={!a.documentId} />
            <a href={attachmentUrl(a)} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate hover:underline">
              {a.name}
            </a>
            {inbound &&
              (pending ? (
                <ImportButton attachment={a} defaults={defaults} />
              ) : (
                <Badge variant="secondary">{t("email.imported")}</Badge>
              ))}
          </div>
        );
      })}
    </div>
  );
}
