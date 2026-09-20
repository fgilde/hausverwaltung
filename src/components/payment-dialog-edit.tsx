"use client";

import { Pencil, Paperclip } from "lucide-react";
import { useTranslations } from "next-intl";
import { updatePaymentDetails } from "@/server/actions/finances";
import { Button } from "@/components/ui/button";
import { CrudDialog } from "@/components/crud-dialog";
import { TextAreaField } from "@/components/form-fields";

type Doc = { id: string; name: string };

// Notiz + Belege einer Kontobewegung bearbeiten (#23).
export function PaymentEditDialog({
  payment,
  documents,
}: {
  payment: { id: string; note: string | null; documentIds: string[] };
  documents: Doc[];
}) {
  const t = useTranslations();
  return (
    <CrudDialog
      trigger={
        <Button variant="ghost" size="icon" aria-label={t("common.edit")} title={t("common.edit")}>
          <Pencil className="size-4" />
        </Button>
      }
      title={t("finances.editTransaction")}
      action={updatePaymentDetails}
      submitLabel={t("common.save")}
    >
      <input type="hidden" name="id" value={payment.id} />
      <TextAreaField name="note" label={t("finances.note")} defaultValue={payment.note ?? undefined} />
      {documents.length > 0 && (
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-sm font-medium">
            <Paperclip className="size-4" /> {t("finances.linkedDocuments")}
          </label>
          <div className="max-h-40 space-y-1 overflow-auto rounded-lg border p-2">
            {documents.map((d) => (
              <label key={d.id} className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted">
                <input
                  type="checkbox"
                  name="documentIds"
                  value={d.id}
                  defaultChecked={payment.documentIds.includes(d.id)}
                  className="size-4"
                />
                <span className="truncate">{d.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </CrudDialog>
  );
}
