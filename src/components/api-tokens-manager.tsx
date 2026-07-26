"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { KeyRound, Copy, Check } from "lucide-react";
import { createApiToken, revokeApiToken, type TokenState } from "@/server/actions/tokens";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Tok = {
  id: string;
  name: string;
  prefix: string;
  userName: string;
  createdAt: string;
  lastUsedAt: string | null;
  revoked: boolean;
};
type Opt = { value: string; label: string };

export function ApiTokensManager({
  tokens,
  users,
  isAdmin,
}: {
  tokens: Tok[];
  users: Opt[];
  isAdmin: boolean;
}) {
  const t = useTranslations();
  const [state, action, pending] = useActionState<TokenState, FormData>(createApiToken, {});
  const [copied, setCopied] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="size-4" />
          {t("tokens.title")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t("tokens.subtitle")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Neu erzeugtes Token — einmalig */}
        {state.token && (
          <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
            <p className="mb-1 text-xs font-medium text-primary">{t("tokens.created")}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded bg-background px-2 py-1 text-xs">{state.token}</code>
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => {
                  navigator.clipboard?.writeText(state.token!);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{t("tokens.onceHint")}</p>
          </div>
        )}

        {/* Anlegen */}
        <form action={action} className="flex flex-wrap items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label htmlFor="tokenName">{t("tokens.name")}</Label>
            <Input id="tokenName" name="name" placeholder={t("tokens.namePlaceholder")} required />
          </div>
          {isAdmin && users.length > 0 && (
            <div className="space-y-1">
              <Label htmlFor="tokenUser">{t("tokens.forUser")}</Label>
              <select
                id="tokenUser"
                name="userId"
                className={cn(
                  "flex h-9 rounded-lg border border-input bg-transparent px-3 text-sm dark:bg-input/30",
                )}
              >
                {users.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <Button type="submit" size="sm" disabled={pending}>
            {t("tokens.create")}
          </Button>
        </form>
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}

        {/* Liste */}
        {tokens.length > 0 && (
          <div className="space-y-2">
            {tokens.map((tok) => (
              <div key={tok.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="font-medium">
                    {tok.name}
                    {tok.revoked && <span className="ml-2 text-xs text-destructive">{t("tokens.revoked")}</span>}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    <code>{tok.prefix}…</code>
                    {isAdmin && ` · ${tok.userName}`}
                    {tok.lastUsedAt ? ` · ${t("tokens.lastUsed")}: ${tok.lastUsedAt}` : ""}
                  </div>
                </div>
                {!tok.revoked && (
                  <form action={revokeApiToken}>
                    <input type="hidden" name="id" value={tok.id} />
                    <Button type="submit" size="sm" variant="ghost">
                      {t("tokens.revoke")}
                    </Button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
