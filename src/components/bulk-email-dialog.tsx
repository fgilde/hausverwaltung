"use client";

import { useTranslations } from "next-intl";
import { Users } from "lucide-react";
import { bulkEmail } from "@/server/actions/email";
import { Button } from "@/components/ui/button";
import { CrudDialog } from "@/components/crud-dialog";
import { TextField, TextAreaField, SelectField } from "@/components/form-fields";

export function BulkEmailDialog({ properties }: { properties: { value: string; label: string }[] }) {
  const t = useTranslations();
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
      <TextField name="subject" label={t("email.subject")} />
      <TextAreaField name="body" label={t("email.body")} required rows={6} />
    </CrudDialog>
  );
}
