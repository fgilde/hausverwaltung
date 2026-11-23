"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { CURRENCIES, type Currency } from "@/lib/currency";
import { updateTenantCurrency } from "@/server/actions/config";
import type { ActionState } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export function CurrencyConfig({ currency }: { currency: Currency }) {
  const t = useTranslations("settings");
  const [state, action, pending] = useActionState<ActionState, FormData>(updateTenantCurrency, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("currency")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("currencyHint")}</p>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col items-start gap-3">
          <input type="hidden" name="previousCurrency" value={currency} />
          <div className="flex items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="currency">{t("currency")}</Label>
              <select id="currency" name="currency" defaultValue={currency}
                className="flex h-9 w-56 rounded-lg border border-input bg-transparent px-3 text-sm dark:bg-input/30">
                {CURRENCIES.map((code) => <option key={code} value={code}>{t(`currencyOptions.${code}`)}</option>)}
              </select>
            </div>
            <Button type="submit" disabled={pending}>{t("save")}</Button>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="confirmCurrency" />
            {t("currencyConfirmation")}
          </label>
          {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
          {state.ok && <p role="status" className="text-sm">{t("saved")}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
