"use client";

import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { createAppointment } from "@/server/actions/appointments";
import { Button } from "@/components/ui/button";
import { CrudDialog } from "@/components/crud-dialog";
import { TextField, TextAreaField, SelectField } from "@/components/form-fields";

const TYPES = ["BESICHTIGUNG", "VERSAMMLUNG", "WARTUNG", "FRIST", "SONSTIGES"] as const;

export function AppointmentDialog({
  properties,
  defaultDate,
}: {
  properties: { value: string; label: string }[];
  defaultDate?: string;
}) {
  const t = useTranslations();
  return (
    <CrudDialog
      trigger={
        <Button size="sm">
          <Plus className="size-4" />
          {t("calendar.add")}
        </Button>
      }
      title={t("calendar.add")}
      action={createAppointment}
      submitLabel={t("common.create")}
    >
      <TextField name="title" label={t("fields.name")} />
      <SelectField
        name="type"
        label={t("fields.type")}
        options={TYPES.map((v) => ({ value: v, label: t(`appointmentType.${v}`) }))}
      />
      <TextField name="start" label={t("calendar.start")} type="datetime-local" defaultValue={defaultDate} />
      <TextField name="end" label={t("calendar.end")} type="datetime-local" required={false} />
      <TextField name="location" label={t("meetings.location")} required={false} />
      <SelectField
        name="propertyId"
        label={t("units.property")}
        options={[{ value: "", label: t("common.none") }, ...properties]}
      />
      <TextAreaField name="note" label={t("fields.note")} />
    </CrudDialog>
  );
}
