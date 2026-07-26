"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Users } from "lucide-react";
import { bulkEmail } from "@/server/actions/email";
import { Button } from "@/components/ui/button";
import { CrudDialog } from "@/components/crud-dialog";
import { SelectField } from "@/components/form-fields";
import { cn } from "@/lib/utils";

type Tpl = { id: string; name: string; subject: string | null; body: string };

const inputCls = cn(
  "flex h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm shadow-xs",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none dark:bg-input/30",
);
const areaCls = cn(
  "flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none dark:bg-input/30",
);

export function BulkEmailDialog({
  properties,
  templates,
}: {
  properties: { value: string; label: string }[];
  templates: Tpl[];
}) {
  const t = useTranslations();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  function applyTemplate(id: string) {
    const tpl = templates.find((x) => x.id === id);
    if (!tpl) return;
    setSubject(tpl.subject ?? "");
    setBody(tpl.body);
  }

  return (
    <CrudDialog
      trigger={
        <Button size="sm" variant="outline">
          <Users className="size-4" />
          {t("email.bulk")}
        </Button>
      }
      title={t("email.bulk")}
      action={bulkEmail}
      submitLabel={t("email.saveToOutbox")}
    >
      <SelectField name="propertyId" label={t("units.property")} options={properties} />
      <SelectField
        name="audience"
        label={t("email.audience")}
        options={[
          { value: "MIETER", label: t("userRole.MIETER") },
          { value: "EIGENTUEMER", label: t("userRole.EIGENTUEMER") },
        ]}
      />
      {templates.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-sm font-medium">{t("email.template")}</label>
          <select
            defaultValue=""
            onChange={(e) => { applyTemplate(e.target.value); e.target.value = ""; }}
            className={cn(inputCls, "text-muted-foreground")}
          >
            <option value="">{t("email.templateChoose")}…</option>
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
            ))}
          </select>
        </div>
      )}
      <div className="space-y-1.5">
        <label htmlFor="bulkSubject" className="text-sm font-medium">{t("email.subject")}</label>
        <input id="bulkSubject" name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} required className={inputCls} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="bulkBody" className="text-sm font-medium">{t("email.body")}</label>
        <textarea id="bulkBody" name="body" value={body} onChange={(e) => setBody(e.target.value)} required rows={6} className={areaCls} />
      </div>
      <p className="text-xs text-muted-foreground">{t("email.placeholderHint")}</p>
    </CrudDialog>
  );
}
