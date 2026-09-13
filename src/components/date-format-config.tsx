"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Check, TriangleAlert, CalendarDays } from "lucide-react";
import { updateDateFormat } from "@/server/actions/config";
import type { ActionState } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

const OPTIONS = [
  { value: "", key: "auto" },
  { value: "de-DE", key: "de" },
  { value: "en-GB", key: "en_gb" },
  { value: "en-US", key: "en_us" },
  { value: "iso", key: "iso" },
];

export function DateFormatConfig({ dateFormat }: { dateFormat: string | null }) {
  const t = useTranslations("settings");
  const [state, action, pending] = useActionState<ActionState, FormData>(updateDateFormat, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="size-4" /> {t("dateFormat")}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{t("dateFormatHint")}</p>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="dateFormat">{t("dateFormat")}</Label>
            <select
              id="dateFormat"
              name="dateFormat"
              defaultValue={dateFormat ?? ""}
              className="flex h-9 w-56 rounded-lg border border-input bg-transparent px-3 text-sm dark:bg-input/30"
            >
              {OPTIONS.map((o) => (
                <option key={o.key} value={o.value}>
                  {t(`dateFormatOptions.${o.key}`)}
                </option>
              ))}
            </select>
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
      </CardContent>
    </Card>
  );
}
