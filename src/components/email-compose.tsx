"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Paperclip } from "lucide-react";
import { createEmail } from "@/server/actions/email";
import { Button } from "@/components/ui/button";
import { CrudDialog } from "@/components/crud-dialog";
import { cn } from "@/lib/utils";

type Person = { id: string; label: string; email: string };
type Doc = { id: string; name: string };

const inputCls = cn(
  "flex h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm shadow-xs",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none dark:bg-input/30",
);
const areaCls = cn(
  "flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none dark:bg-input/30",
);

const TEMPLATES = ["reminder", "info", "statement"] as const;

export function EmailCompose({ persons, documents }: { persons: Person[]; documents: Doc[] }) {
  const t = useTranslations();
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  function addPerson(email: string) {
    if (!email) return;
    setTo((cur) => {
      const parts = cur.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
      if (parts.includes(email)) return cur;
      return parts.length ? `${cur.replace(/[,;\s]*$/, "")}, ${email}` : email;
    });
  }
  function applyTemplate(key: string) {
    if (!key) return;
    setSubject(t(`email.tpl.${key}.subject`));
    setBody(t(`email.tpl.${key}.body`));
  }

  return (
    <CrudDialog
      trigger={
        <Button size="sm">
          <Plus className="size-4" />
          {t("email.compose")}
        </Button>
      }
      title={t("email.compose")}
      action={createEmail}
      submitLabel={t("email.saveToOutbox")}
    >
      <div className="space-y-1.5">
        <label className="text-sm font-medium">{t("email.template")}</label>
        <select defaultValue="" onChange={(e) => { applyTemplate(e.target.value); e.target.value = ""; }} className={cn(inputCls, "text-muted-foreground")}>
          <option value="">{t("email.templateChoose")}…</option>
          {TEMPLATES.map((k) => (
            <option key={k} value={k}>{t(`email.tpl.${k}.name`)}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="toAddress" className="text-sm font-medium">{t("email.to")}</label>
        <input id="toAddress" name="toAddress" value={to} onChange={(e) => setTo(e.target.value)} placeholder={t("email.toPlaceholder")} required className={inputCls} />
        {persons.length > 0 && (
          <select aria-label={t("email.addPerson")} defaultValue="" onChange={(e) => { addPerson(e.target.value); e.target.value = ""; }} className={cn(inputCls, "text-muted-foreground")}>
            <option value="">{t("email.addPerson")}…</option>
            {persons.map((p) => (<option key={p.id} value={p.email}>{p.label} · {p.email}</option>))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="cc" className="text-sm font-medium">Cc</label>
          <input id="cc" name="cc" className={inputCls} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="bcc" className="text-sm font-medium">Bcc</label>
          <input id="bcc" name="bcc" className={inputCls} />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="subject" className="text-sm font-medium">{t("email.subject")}</label>
        <input id="subject" name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} required className={inputCls} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="body" className="text-sm font-medium">{t("email.body")}</label>
        <textarea id="body" name="body" value={body} onChange={(e) => setBody(e.target.value)} required rows={6} className={areaCls} />
      </div>

      {documents.length > 0 && (
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-sm font-medium">
            <Paperclip className="size-4" /> {t("email.attachments")}
          </label>
          <div className="max-h-40 space-y-1 overflow-auto rounded-lg border p-2">
            {documents.map((d) => (
              <label key={d.id} className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted">
                <input type="checkbox" name="documentIds" value={d.id} className="size-4" />
                <span className="truncate">{d.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </CrudDialog>
  );
}
