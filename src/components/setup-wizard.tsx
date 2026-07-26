"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Building2, Palette, Home, Rocket, ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { setupSystem } from "@/server/actions/setup";
import type { ActionState } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const PRESETS = [
  { name: "Indigo", color: "#4f46e5" },
  { name: "Blau", color: "#2563eb" },
  { name: "Smaragd", color: "#059669" },
  { name: "Violett", color: "#7c3aed" },
  { name: "Bernstein", color: "#d97706" },
  { name: "Rosé", color: "#e11d48" },
  { name: "Schiefer", color: "#334155" },
  { name: "Türkis", color: "#0d9488" },
];

const selectCls = cn(
  "flex h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm shadow-xs",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none dark:bg-input/30",
);

export function SetupWizard() {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState<ActionState, FormData>(setupSystem, {});
  const [step, setStep] = useState(0);
  const [f, setF] = useState({
    tenantName: "",
    name: "",
    email: "",
    password: "",
    locale: "de",
    brandColor: "#4f46e5",
    propertyName: "",
    propertyStreet: "",
    propertyZip: "",
    propertyCity: "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  const steps = [
    { key: "welcome", icon: Rocket },
    { key: "account", icon: Building2 },
    { key: "branding", icon: Palette },
    { key: "property", icon: Home },
    { key: "done", icon: Check },
  ];
  const last = steps.length - 1;

  const accountValid =
    f.tenantName.trim() !== "" && f.name.trim() !== "" && /.+@.+\..+/.test(f.email) && f.password.length >= 6;
  const canNext = step === 1 ? accountValid : true;

  return (
    <form action={formAction} className="space-y-6">
      {/* Fortschritt */}
      <div className="flex items-center justify-center gap-2">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className={cn(
                "grid size-8 place-items-center rounded-full border text-xs transition-colors",
                i < step && "border-primary bg-primary text-primary-foreground",
                i === step && "border-primary text-primary",
                i > step && "border-input text-muted-foreground",
              )}
            >
              {i < step ? <Check className="size-4" /> : <s.icon className="size-4" />}
            </div>
            {i < last && <div className={cn("h-px w-6", i < step ? "bg-primary" : "bg-border")} />}
          </div>
        ))}
      </div>

      {/* Alle Felder immer im DOM (ein Formular, ein Submit) — Schritte nur ein-/ausgeblendet */}
      <div className="min-h-[280px]">
        {/* 0 Willkommen */}
        <div className={cn("space-y-3 text-center", step !== 0 && "hidden")}>
          <h2 className="text-xl font-semibold">{t("setup.welcomeTitle")}</h2>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">{t("setup.welcomeText")}</p>
        </div>

        {/* 1 Account */}
        <div className={cn("space-y-4", step !== 1 && "hidden")}>
          <div className="space-y-2">
            <Label htmlFor="tenantName">{t("setup.tenantName")}</Label>
            <Input id="tenantName" name="tenantName" value={f.tenantName} onChange={set("tenantName")} placeholder={t("setup.tenantNamePlaceholder")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("setup.adminName")}</Label>
              <Input id="name" name="name" value={f.name} onChange={set("name")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="locale">{t("common.language")}</Label>
              <select id="locale" name="locale" value={f.locale} onChange={set("locale")} className={selectCls}>
                <option value="de">Deutsch</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t("login.email")}</Label>
            <Input id="email" name="email" type="email" value={f.email} onChange={set("email")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("login.password")}</Label>
            <Input id="password" name="password" type="password" value={f.password} onChange={set("password")} />
            <p className="text-xs text-muted-foreground">{t("setup.passwordHint")}</p>
          </div>
        </div>

        {/* 2 Branding */}
        <div className={cn("space-y-4", step !== 2 && "hidden")}>
          <p className="text-sm text-muted-foreground">{t("setup.brandingText")}</p>
          <input type="hidden" name="brandColor" value={f.brandColor} />
          <div className="grid grid-cols-4 gap-3">
            {PRESETS.map((p) => (
              <button
                type="button"
                key={p.color}
                onClick={() => setF((s) => ({ ...s, brandColor: p.color }))}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-lg border p-2 text-xs transition-all",
                  f.brandColor === p.color ? "border-primary ring-2 ring-primary/40" : "hover:bg-muted",
                )}
              >
                <span className="size-8 rounded-full" style={{ backgroundColor: p.color }} />
                {p.name}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 pt-1">
            <input
              type="color"
              value={f.brandColor}
              onChange={(e) => setF((s) => ({ ...s, brandColor: e.target.value }))}
              className="h-9 w-14 cursor-pointer rounded-lg border border-input bg-transparent"
            />
            <span className="inline-flex h-8 items-center rounded-md px-4 text-sm font-medium text-white" style={{ backgroundColor: f.brandColor }}>
              {t("setup.preview")}
            </span>
            <code className="text-xs text-muted-foreground">{f.brandColor}</code>
          </div>
        </div>

        {/* 3 Erstes Objekt (optional) */}
        <div className={cn("space-y-4", step !== 3 && "hidden")}>
          <p className="text-sm text-muted-foreground">{t("setup.propertyText")}</p>
          <div className="space-y-2">
            <Label htmlFor="propertyName">{t("fields.name")}</Label>
            <Input id="propertyName" name="propertyName" value={f.propertyName} onChange={set("propertyName")} placeholder={t("setup.propertyOptional")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="propertyStreet">{t("fields.street")}</Label>
            <Input id="propertyStreet" name="propertyStreet" value={f.propertyStreet} onChange={set("propertyStreet")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="propertyZip">{t("fields.zip")}</Label>
              <Input id="propertyZip" name="propertyZip" value={f.propertyZip} onChange={set("propertyZip")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="propertyCity">{t("fields.city")}</Label>
              <Input id="propertyCity" name="propertyCity" value={f.propertyCity} onChange={set("propertyCity")} />
            </div>
          </div>
        </div>

        {/* 4 Fertig */}
        <div className={cn("space-y-3 text-center", step !== last && "hidden")}>
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <Check className="size-7" />
          </div>
          <h2 className="text-xl font-semibold">{t("setup.doneTitle")}</h2>
          <div className="mx-auto max-w-sm space-y-1 text-sm text-muted-foreground">
            <div>{f.tenantName || "—"}</div>
            <div>{f.email}</div>
            {f.propertyName && <div>{t("nav.properties")}: {f.propertyName}</div>}
          </div>
        </div>
      </div>

      {state.error && <p className="text-center text-sm text-destructive">{state.error}</p>}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" size="sm" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          <ArrowLeft className="size-4" />
          {t("setup.back")}
        </Button>

        {step < last ? (
          <div className="flex gap-2">
            {(step === 2 || step === 3) && (
              <Button type="button" variant="outline" size="sm" onClick={() => setStep((s) => s + 1)}>
                {t("setup.skip")}
              </Button>
            )}
            <Button type="button" size="sm" onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
              {t("setup.next")}
              <ArrowRight className="size-4" />
            </Button>
          </div>
        ) : (
          <Button type="submit" size="sm" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {t("setup.submit")}
          </Button>
        )}
      </div>
    </form>
  );
}
