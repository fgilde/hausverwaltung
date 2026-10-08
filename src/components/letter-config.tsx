"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Check, TriangleAlert, Mailbox } from "lucide-react";
import { updateLetterConfig, testLetterConfig } from "@/server/actions/letters";
import type { ActionState } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Briefversand (#58): Zugangsdaten für Pingen und Deutsche Post (E-POSTBUSINESS).
// Secrets werden nie angezeigt; leeres Feld = unverändert.

function Feedback({ state, okLabel }: { state: ActionState; okLabel: string }) {
  if (state.error)
    return (
      <span className="flex items-center gap-1.5 text-sm text-destructive">
        <TriangleAlert className="size-4 shrink-0" /> {state.error}
      </span>
    );
  if (state.ok)
    return (
      <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
        <Check className="size-4" /> {okLabel}
      </span>
    );
  return null;
}

function Field(props: { name: string; label: string; type?: string; defaultValue?: string | null; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={props.name}>{props.label}</Label>
      <Input
        id={props.name}
        name={props.name}
        type={props.type ?? "text"}
        defaultValue={props.defaultValue ?? ""}
        placeholder={props.placeholder}
        autoComplete={props.type === "password" ? "new-password" : "off"}
      />
    </div>
  );
}

function ProviderCard({
  provider,
  title,
  hint,
  children,
}: {
  provider: "PINGEN" | "EPOST";
  title: string;
  hint: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = useTranslations("letters");
  const tc = useTranslations("config");
  const [save, saveAction, saving] = useActionState<ActionState, FormData>(updateLetterConfig, {});
  const [test, testAction, testing] = useActionState<ActionState, FormData>(testLetterConfig, {});
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mailbox className="size-4" /> {title}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={saveAction} className="space-y-4">
          <input type="hidden" name="provider" value={provider} />
          {children}
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving}>{tc("save")}</Button>
            <Feedback state={save} okLabel={tc("saved")} />
          </div>
        </form>
        <form action={testAction} className="flex items-center gap-3 border-t pt-4">
          <input type="hidden" name="provider" value={provider} />
          <Button type="submit" variant="outline" disabled={testing}>
            {testing ? tc("testing") : tc("test")}
          </Button>
          <Feedback state={test} okLabel={t("configOk")} />
        </form>
      </CardContent>
    </Card>
  );
}

export function LetterConfig({
  pingen,
  epost,
}: {
  pingen: { clientId: string | null; orgId: string | null; staging: boolean; hasSecret: boolean };
  epost: { vendorId: string | null; ekp: string | null; test: boolean; hasPassword: boolean; hasSecret: boolean };
}) {
  const t = useTranslations("letters");
  const keep = t("secretKeep");
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ProviderCard
        provider="PINGEN"
        title={t("provider_PINGEN")}
        hint={
          <>
            {t("pingenHint")}{" "}
            <a href="https://app.pingen.com" target="_blank" rel="noopener noreferrer" className="underline">app.pingen.com</a>
          </>
        }
      >
        <Field name="pingenClientId" label={t("clientId")} defaultValue={pingen.clientId} />
        <Field name="pingenClientSecret" label={t("clientSecret")} type="password" placeholder={pingen.hasSecret ? keep : ""} />
        <Field name="pingenOrgId" label={t("orgId")} defaultValue={pingen.orgId} placeholder={t("orgIdPlaceholder")} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="pingenStaging" defaultChecked={pingen.staging} className="size-4" /> {t("pingenStaging")}
        </label>
      </ProviderCard>
      <ProviderCard provider="EPOST" title={t("provider_EPOST")} hint={t("epostHint")}>
        <div className="grid grid-cols-2 gap-3">
          <Field name="epostVendorId" label={t("vendorId")} defaultValue={epost.vendorId} />
          <Field name="epostEkp" label={t("ekp")} defaultValue={epost.ekp} placeholder="1234567890" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field name="epostPassword" label={t("password")} type="password" placeholder={epost.hasPassword ? keep : ""} />
          <Field name="epostSecret" label={t("secret")} type="password" placeholder={epost.hasSecret ? keep : ""} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="epostTest" defaultChecked={epost.test} className="size-4" /> {t("epostTest")}
        </label>
      </ProviderCard>
    </div>
  );
}
