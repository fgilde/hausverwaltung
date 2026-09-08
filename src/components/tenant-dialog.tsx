import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CrudDialog } from "@/components/crud-dialog";
import { TextField } from "@/components/form-fields";
import { createTenant } from "@/server/actions/tenants";

export async function TenantDialog() {
  const t = await getTranslations();
  return (
    <CrudDialog
      trigger={
        <Button size="sm">
          <Plus className="size-4" />
          {t("tenants.new")}
        </Button>
      }
      title={t("tenants.new")}
      action={createTenant}
      submitLabel={t("common.create")}
    >
      <TextField name="name" label={t("tenants.name")} />
      <TextField name="adminName" label={t("tenants.adminName")} required={false} />
      <TextField name="adminEmail" label={t("tenants.adminEmail")} type="email" />
      <TextField name="adminPassword" label={t("tenants.adminPassword")} type="password" />
    </CrudDialog>
  );
}
