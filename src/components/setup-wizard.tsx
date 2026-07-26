"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { setupSystem } from "@/server/actions/setup";
import type { ActionState } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const selectCls = cn(
  "flex h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm shadow-xs",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none dark:bg-input/30",
);

export function SetupWizard() {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState<ActionState, FormData>(setupSystem, {});
  const [color, setColor] = useState("#4f46e5");

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="tenantName">{t("setup.tenantName")}</Label>
        <Input id="tenantName" name="tenantName" required placeholder={t("setup.tenantNamePlaceholder")} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">{t("setup.adminName")}</Label>
          <Input id="name" name="name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="locale">{t("common.language")}</Label>
          <select id="locale" name="locale" defaultValue="de" className={selectCls}>
            <option value="de">Deutsch</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">{t("login.email")}</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{t("login.password")}</Label>
        <Input id="password" name="password" type="password" required minLength={6} />
        <p className="text-xs text-muted-foreground">{t("setup.passwordHint")}</p>
      </div>

      {/* Theme-Farbe mit Vorschau */}
      <div className="space-y-2">
        <Label htmlFor="brandColor">{t("setup.brandColor")}</Label>
        <div className="flex items-center gap-3">
          <input
            id="brandColor"
            name="brandColor"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-14 cursor-pointer rounded-lg border border-input bg-transparent"
          />
          <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5">
            <span
              className="inline-flex h-6 items-center rounded-md px-3 text-xs font-medium text-white"
              style={{ backgroundColor: color }}
            >
              {t("setup.preview")}
            </span>
            <code className="text-xs text-muted-foreground">{color}</code>
          </div>
        </div>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {t("setup.submit")}
      </Button>
    </form>
  );
}
