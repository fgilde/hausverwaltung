"use client";

import { useActionState, useEffect, useState } from "react";
import { FileText, Send, Check, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignaturePad } from "@/components/signature-pad";
import { sendWohnungsgeber } from "@/server/actions/email";
import type { ActionState } from "@/lib/schemas";
import { toast } from "sonner";

// Wohnungsgeberbestätigung (#41/#55): Wohnungsgeber prüfen, Ort/Datum (vorausgefüllt),
// digital unterschreiben, dann als PDF öffnen oder direkt per E-Mail an die Mieter senden.
export function WohnungsgeberDialog({
  leaseId,
  name,
  address,
  place,
  today,
  renterEmails,
}: {
  leaseId: string;
  name: string;
  address: string;
  place: string;
  today: string;
  renterEmails: string[];
}) {
  const t = useTranslations("leases");
  const [open, setOpen] = useState(false);
  const [state, sendAction, sending] = useActionState<ActionState, FormData>(sendWohnungsgeber, {});
  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      toast.success(t("wgSent"));
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" title={t("wohnungsgeber")} />}>
        <FileText className="size-4" />
        {t("wohnungsgeber")}
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("wohnungsgeber")}</DialogTitle>
        </DialogHeader>
        {/* Standard-Absenden öffnet das PDF (POST, die Unterschrift passt nicht in die URL);
            „Per E-Mail senden“ nutzt dieselben Felder über die Server-Action. */}
        <form method="post" action={`/api/leases/${leaseId}/wohnungsgeber`} target="_blank" className="space-y-4">
          <input type="hidden" name="leaseId" value={leaseId} />
          <p className="text-sm text-muted-foreground">{t("wgHint")}</p>
          <div className="space-y-1.5">
            <Label htmlFor="wgName">{t("wgName")}</Label>
            <Input id="wgName" name="name" defaultValue={name} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wgAddress">{t("wgAddress")}</Label>
            <Input id="wgAddress" name="address" defaultValue={address} placeholder={t("wgAddressPlaceholder")} required />
            {!address && <p className="text-xs text-muted-foreground">{t("wgNoAddress")}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="wgPlace">{t("wgPlace")}</Label>
              <Input id="wgPlace" name="place" defaultValue={place} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wgDate">{t("wgDate")}</Label>
              <Input id="wgDate" name="signedOn" defaultValue={today} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("wgSignature")}</Label>
            <SignaturePad name="signature" />
          </div>
          {state.error && (
            <p className="flex items-center gap-1 text-sm text-destructive">
              <TriangleAlert className="size-4" /> {state.error}
            </p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <Button type="submit" variant="outline">
              <FileText className="size-4" /> {t("wgCreate")}
            </Button>
            <Button type="submit" formAction={sendAction} disabled={sending || renterEmails.length === 0}>
              {state.ok ? <Check className="size-4" /> : <Send className="size-4" />} {sending ? t("wgSending") : t("wgSend")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {renterEmails.length ? t("wgSendTo", { to: renterEmails.join(", ") }) : t("wgNoEmail")}
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
