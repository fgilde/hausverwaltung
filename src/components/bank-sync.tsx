"use client";

import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Landmark, RefreshCw, Check, TriangleAlert, Plus } from "lucide-react";
import {
  saveBankConnector,
  syncBankLink,
  deleteBankLink,
  startBankAuth,
  listBankAspsps,
} from "@/server/actions/banking";
import type { ActionState } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Connector = { applicationId: string; baseUrl: string | null; psuType: string; hasKey: boolean };
type Link = { id: string; aspspName: string; accountName: string; lastSyncAt: string | null };

export function BankSync({
  isAdmin,
  connector,
  redirectUrl,
  links,
}: {
  isAdmin: boolean;
  connector: Connector | null;
  redirectUrl: string;
  links: Link[];
}) {
  const t = useTranslations("bank");
  const [cfgState, cfgAction, cfgPending] = useActionState<ActionState, FormData>(saveBankConnector, {});
  const [cfgOpen, setCfgOpen] = useState(!connector && isAdmin);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Landmark className="size-4" /> {t("title")}
        </CardTitle>
        <div className="flex items-center gap-2">
          {connector && <ConnectDialog />}
          {isAdmin && (
            <Button variant="ghost" size="sm" onClick={() => setCfgOpen((o) => !o)}>
              {t("configure")}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!connector && <p className="text-sm text-muted-foreground">{t("notConfigured")}</p>}

        {/* Connector-Konfiguration (nur Admin) */}
        {isAdmin && cfgOpen && (
          <form action={cfgAction} className="space-y-3 rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">{t("hint")}</p>
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
                placeholder={connector?.hasKey ? "•••••••• (gesetzt — leer lassen zum Behalten)" : "-----BEGIN PRIVATE KEY-----"}
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
            <div className="flex items-center gap-3">
              <Button type="submit" size="sm" disabled={cfgPending}>{t("save")}</Button>
              {cfgState.error && <span className="flex items-center gap-1 text-sm text-destructive"><TriangleAlert className="size-4" />{cfgState.error}</span>}
              {cfgState.ok && <span className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400"><Check className="size-4" />{t("saved")}</span>}
            </div>
          </form>
        )}

        {/* Verknüpfte Bankkonten */}
        {links.length > 0 && (
          <div className="space-y-2">
            {links.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                <div>
                  <div className="font-medium">{l.accountName}</div>
                  <div className="text-xs text-muted-foreground">
                    {l.aspspName}
                    {l.lastSyncAt ? ` · ${t("lastSync")}: ${l.lastSyncAt}` : ` · ${t("neverSynced")}`}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <SyncButton id={l.id} label={t("sync")} />
                  <form action={deleteBankLink}>
                    <input type="hidden" name="id" value={l.id} />
                    <Button type="submit" variant="ghost" size="sm" className="text-destructive">{t("unlink")}</Button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SyncButton({ id, label }: { id: string; label: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const fd = new FormData();
            fd.set("id", id);
            const r = await syncBankLink(fd);
            setMsg(r.error ?? "OK");
          })
        }
      >
        <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} /> {label}
      </Button>
    </div>
  );
}

function ConnectDialog() {
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
      <DialogTrigger render={<Button size="sm"><Plus className="size-4" />{t("connect")}</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("connect")}</DialogTitle>
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
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
              <Button type="submit" className="w-full">{t("startConsent")}</Button>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
