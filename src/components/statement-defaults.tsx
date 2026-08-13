"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Check, TriangleAlert, Percent } from "lucide-react";
import { updateStatementDefaults } from "@/server/actions/config";
import type { ActionState } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function StatementDefaults({ heatingConsumptionPct }: { heatingConsumptionPct: number | null }) {
  const t = useTranslations("statements");
  const [state, action, pending] = useActionState<ActionState, FormData>(updateStatementDefaults, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Percent className="size-4" /> {t("defaultsTitle")}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{t("heatingShareHint")}</p>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="heatingConsumptionPct">{t("heatingShare")}</Label>
            <Input
              id="heatingConsumptionPct"
              name="heatingConsumptionPct"
              type="number"
              min={0}
              max={100}
              defaultValue={heatingConsumptionPct ?? ""}
              placeholder="70"
              className="w-28"
            />
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
