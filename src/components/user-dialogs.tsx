"use client";

import { useTranslations } from "next-intl";
import { UserPlus } from "lucide-react";
import { createUser } from "@/server/actions/users";
import { Button } from "@/components/ui/button";
import { CrudDialog } from "@/components/crud-dialog";
import { TextField, SelectField } from "@/components/form-fields";

export function UserDialog({
  roles,
  persons,
}: {
  roles: { value: string; label: string }[];
  persons: { value: string; label: string }[];
}) {
  const t = useTranslations();
  return (
    <CrudDialog
      trigger={
        <Button size="sm">
          <UserPlus className="size-4" />
          {t("settings.newUser")}
        </Button>
      }
      title={t("settings.newUser")}
      action={createUser}
      submitLabel={t("common.create")}
    >
      <TextField name="name" label={t("fields.name")} />
      <TextField name="email" label={t("fields.email")} type="email" />
      <TextField name="password" label={t("fields.password")} type="password" />
      <SelectField name="role" label={t("settings.role")} options={roles} />
      <SelectField
        name="personId"
        label={t("settings.linkedPerson")}
        options={[{ value: "", label: t("common.none") }, ...persons]}
      />
    </CrudDialog>
  );
}
