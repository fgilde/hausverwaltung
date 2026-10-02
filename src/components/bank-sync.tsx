"use client";

import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Landmark, RefreshCw, Check, TriangleAlert, Link2 } from "lucide-react";
import { saveBankConnector, syncAllBankLinks, startBankAuth, listBankAspsps } from "@/server/actions/banking";
import type { ActionState } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Connector = { applicationId: string; baseUrl: string | null; psuType: string; autoSync: boolean; lastAutoSyncAt: string | null };

/** Bank-Connector (Enable Banking) + täglicher Auto-Sync, in den Einstellungen (#53/#54, nur Admin). */
export function BankConnectorConfig({ connector, redirectUrl }: { connector: Connector | null; redirectUrl: string }) {
  const t = useTranslations("bank");
  const [state, action, pending] = useActionState<ActionState, FormData>(saveBankConnector, {});
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Landmark className="size-4" /> {t("title")}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{t("hint")}</p>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="redir">{t("redirectUrl")}</Label>
            <Input id="redir" readOnly value={redirectUrl} onFocus={(e) => e.currentTarget.select()} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="applicationId">{t("applicationId")}</Label>
            <Input id="applicationId" name="applicationId" defaultValue={connector?.applicationId} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="privateKey">{t("privateKey")}</Label>
            <textarea
              id="privateKey"
              name="privateKey"
              rows={4}
              placeholder={connector ? t("keyKept") : "-----BEGIN PRIVATE KEY-----"}
              className="w-full rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-xs dark:bg-input/30"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="psuType">{t("psuType")}</Label>
              <select
                id="psuType"
                name="psuType"
                defaultValue={connector?.psuType ?? "business"}
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm dark:bg-input/30"
              >
                <option value="business">business</option>
                <option value="personal">personal</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="baseUrl">{t("baseUrl")}</Label>
              <Input id="baseUrl" name="baseUrl" defaultValue={connector?.baseUrl ?? ""} placeholder="https://api.enablebanking.com" />
            </div>
          </div>
          <label className="flex items-start gap-2 rounded-lg border p-3 text-sm">
            <input type="checkbox" name="autoSync" defaultChecked={connector?.autoSync} className="mt-0.5 size-4" />
            <span>
              <span className="font-medium">{t("autoSync")}</span>
              <span className="block text-xs text-muted-foreground">
                {t("autoSyncHint")}
                {connector?.lastAutoSyncAt && ` ${t("lastAutoSync", { date: connector.lastAutoSyncAt })}`}
              </span>
            </span>
          </label>
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={pending}>{t("save")}</Button>
            {state.error && (
              <span className="flex items-center gap-1 text-sm text-destructive">
                <TriangleAlert className="size-4" />
                {state.error}
              </span>
            )}
            {state.ok && (
              <span className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
                <Check className="size-4" />
                {t("saved")}
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/** „Konten synchronisieren“: alle verbundenen Konten auf einmal (#53). */
export function SyncAllButton() {
  const t = useTranslations("bank");
  const [res, action, pending] = useActionState<ActionState, FormData>(syncAllBankLinks, {});
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <Button type="submit" size="sm" disabled={pending}>
        <RefreshCw className={cn("size-4", pending && "animate-spin")} /> {pending ? t("loading") : t("syncAll")}
      </Button>
      {res.error && <span className={cn("text-xs", res.ok ? "text-muted-foreground" : "text-destructive")}>{res.error}</span>}
    </form>
  );
}

/** „Konto verbinden“: Bank wählen, Consent bei der Bank erteilen (#53). */
export function BankConnectButton() {
  const t = useTranslations("bank");
  const [open, setOpen] = useState(false);
  const [country, setCountry] = useState("DE");
  const [banks, setBanks] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const load = () =>
    start(async () => {
      setErr(null);
      const r = await listBankAspsps(country);
      if (r.error) setErr(r.error);
      else setBanks(r.banks ?? []);
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            <Link2 className="size-4" />
            {t("connectAccount")}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("connectAccount")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="country">{t("country")}</Label>
              <Input id="country" value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} className="w-24" />
            </div>
            <Button type="button" variant="outline" size="sm" disabled={pending} onClick={load}>
              {pending ? t("loading") : t("loadBanks")}
            </Button>
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
          {banks.length > 0 && (
            <form action={startBankAuth} className="space-y-2">
              <input type="hidden" name="aspspCountry" value={country} />
              <Label htmlFor="aspspName">{t("bank")}</Label>
              <select
                id="aspspName"
                name="aspspName"
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm dark:bg-input/30"
              >
                {banks.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              <Button type="submit" className="w-full">
                {t("startConsent")}
              </Button>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
