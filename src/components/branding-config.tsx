"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useEffect } from "react";
import { updateBranding, uploadLogo, removeLogo } from "@/server/actions/branding";
import type { ActionState } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function BrandingConfig({ brandColor, hasLogo }: { brandColor: string | null; hasLogo: boolean }) {
  const t = useTranslations();
  const [color, setColor] = useState(brandColor ?? "#4f46e5");
  const [colorState, colorAction, colorPending] = useActionState<ActionState, FormData>(updateBranding, {});
  const [logoState, logoAction, logoPending] = useActionState<ActionState, FormData>(uploadLogo, {});

  useEffect(() => {
    if (colorState.ok) toast.success(t("common.saved"));
  }, [colorState, t]);
  useEffect(() => {
    if (logoState.ok) toast.success(t("common.saved"));
  }, [logoState, t]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("branding.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Theme-Farbe */}
        <form action={colorAction} className="space-y-2">
          <Label htmlFor="brandColor">{t("branding.color")}</Label>
          <div className="flex items-center gap-3">
            <input
              id="brandColor"
              name="brandColor"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-14 cursor-pointer rounded-lg border border-input bg-transparent"
            />
            <span
              className="inline-flex h-8 items-center rounded-md px-3 text-sm font-medium text-white"
              style={{ backgroundColor: color }}
            >
              {t("setup.preview")}
            </span>
            <Button type="submit" size="sm" variant="outline" disabled={colorPending}>
              {t("common.save")}
            </Button>
          </div>
          {colorState.error && <p className="text-sm text-destructive">{colorState.error}</p>}
        </form>

        {/* Logo */}
        <form action={logoAction} className="space-y-2">
          <Label htmlFor="logo">{t("branding.logo")}</Label>
          <div className="flex flex-wrap items-center gap-3">
            {hasLogo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/api/logo" alt="Logo" className="size-10 rounded-md border object-contain" />
            )}
            <Input id="logo" name="logo" type="file" accept="image/*" className="max-w-xs" />
            <Button type="submit" size="sm" variant="outline" disabled={logoPending}>
              {t("branding.uploadLogo")}
            </Button>
            {hasLogo && (
              <Button type="submit" size="sm" variant="ghost" formAction={removeLogo}>
                {t("branding.removeLogo")}
              </Button>
            )}
          </div>
          {logoState.error && <p className="text-sm text-destructive">{logoState.error}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
