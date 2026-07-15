"use client";

import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { createEmail } from "@/server/actions/email";
import { Button } from "@/components/ui/button";
import { CrudDialog } from "@/components/crud-dialog";
import { TextField, TextAreaField } from "@/components/form-fields";

export function EmailDialog() {
  const t = useTranslations();
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
      submitLabel={t("common.create")}
    >
      <TextField name="toAddress" label={t("email.to")} type="email" />
      <TextField name="subject" label={t("email.subject")} />
      <TextAreaField name="body" label={t("email.body")} required rows={6} />
    </CrudDialog>
  );
}
