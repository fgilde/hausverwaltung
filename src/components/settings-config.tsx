"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Sparkles, Mail, Check, TriangleAlert } from "lucide-react";
import {
  updateAiConfig,
  testAiConfig,
  updateSmtpConfig,
  testSmtpConfig,
} from "@/server/actions/config";
import type { ActionState } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function Feedback({ state, okLabel }: { state: ActionState; okLabel: string }) {
  if (state.error)
    return (
      <span className="flex items-center gap-1.5 text-sm text-destructive">
        <TriangleAlert className="size-4" /> {state.error}
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

function Field({
  name,
  label,
  type = "text",
  defaultValue,
  placeholder,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string | number;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue} placeholder={placeholder} />
    </div>
  );
}

export function SettingsConfig({
  ai,
  smtp,
}: {
  ai: { model: string | null; hasKey: boolean };
  smtp: {
    host: string | null;
    port: number | null;
    user: string | null;
    from: string | null;
    secure: boolean;
    hasPassword: boolean;
  };
}) {
  const t = useTranslations("config");
  const [aiSave, aiSaveAction, aiSaving] = useActionState<ActionState, FormData>(updateAiConfig, {});
  const [aiTest, aiTestAction, aiTesting] = useActionState<ActionState, FormData>(testAiConfig, {});
  const [smSave, smSaveAction, smSaving] = useActionState<ActionState, FormData>(updateSmtpConfig, {});
  const [smTest, smTestAction, smTesting] = useActionState<ActionState, FormData>(testSmtpConfig, {});

  const keyPlaceholder = ai.hasKey ? t("keySet") : "sk-ant-…";
  const pwPlaceholder = smtp.hasPassword ? t("keySet") : "";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* KI */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4" /> {t("aiTitle")}
          </CardTitle>
          <p className="text-xs text-muted-foreground">{t("aiHint")}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={aiSaveAction} className="space-y-4">
            <Field name="aiApiKey" label={t("apiKey")} type="password" placeholder={keyPlaceholder} />
            <Field name="aiModel" label={t("model")} defaultValue={ai.model ?? ""} placeholder="claude-opus-4-8" />
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={aiSaving}>{t("save")}</Button>
              <Feedback state={aiSave} okLabel={t("saved")} />
            </div>
          </form>
          <form action={aiTestAction} className="flex items-center gap-3 border-t pt-4">
            <Button type="submit" variant="outline" disabled={aiTesting}>
              {aiTesting ? t("testing") : t("test")}
            </Button>
            <Feedback state={aiTest} okLabel={t("aiOk")} />
          </form>
        </CardContent>
      </Card>

      {/* SMTP */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="size-4" /> {t("smtpTitle")}
          </CardTitle>
          <p className="text-xs text-muted-foreground">{t("smtpHint")}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={smSaveAction} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field name="smtpHost" label={t("host")} defaultValue={smtp.host ?? ""} placeholder="smtp.example.de" />
              <Field name="smtpPort" label={t("port")} type="number" defaultValue={smtp.port ?? 587} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field name="smtpUser" label={t("user")} defaultValue={smtp.user ?? ""} />
              <Field name="smtpPassword" label={t("password")} type="password" placeholder={pwPlaceholder} />
            </div>
            <Field name="smtpFrom" label={t("from")} type="email" defaultValue={smtp.from ?? ""} placeholder="verwaltung@example.de" />
            <div className="space-y-1.5">
              <Label htmlFor="smtpSecure">{t("secure")}</Label>
              <select
                id="smtpSecure"
                name="smtpSecure"
                defaultValue={smtp.secure ? "true" : "false"}
                className={cn(
                  "flex h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm shadow-xs",
                  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none dark:bg-input/30",
                )}
              >
                <option value="false">{t("secureNo")}</option>
                <option value="true">{t("secureYes")}</option>
              </select>
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={smSaving}>{t("save")}</Button>
              <Feedback state={smSave} okLabel={t("saved")} />
            </div>
          </form>
          <form action={smTestAction} className="flex items-center gap-3 border-t pt-4">
            <Button type="submit" variant="outline" disabled={smTesting}>
              {smTesting ? t("testing") : t("test")}
            </Button>
            <Feedback state={smTest} okLabel={t("smtpOk")} />
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
