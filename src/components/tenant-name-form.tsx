"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Check, TriangleAlert } from "lucide-react";
import { updateTenantName } from "@/server/actions/config";
import type { ActionState } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TenantNameForm({ name, editable }: { name: string; editable: boolean }) {
  const t = useTranslations("settings");
  const [state, action, pending] = useActionState<ActionState, FormData>(updateTenantName, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("tenant")}</CardTitle>
      </CardHeader>
      <CardContent>
        {editable ? (
          <form action={action} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="tenantName">{t("tenantName")}</Label>
              <Input id="tenantName" name="name" defaultValue={name} required />
            </div>
            <Button type="submit" disabled={pending}>{t("save")}</Button>
            {state.error && (
              <span className="flex items-center gap-1.5 text-sm text-destructive">
                <TriangleAlert className="size-4" /> {state.error}
              </span>
            )}
            {state.ok && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                <Check className="size-4" /> {t("saved")}
              </span>
            )}
          </form>
        ) : (
          <div className="text-lg font-medium">{name}</div>
        )}
      </CardContent>
    </Card>
  );
}
