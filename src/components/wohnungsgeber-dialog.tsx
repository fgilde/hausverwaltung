"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Wohnungsgeberbestätigung (#41): Wohnungsgeber vor dem Erzeugen prüfen/ändern.
// Vorbelegt mit Name + Anschrift der Verwaltung; das PDF öffnet in neuem Tab.
export function WohnungsgeberDialog({ leaseId, name, address }: { leaseId: string; name: string; address: string }) {
  const t = useTranslations("leases");
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" title={t("wohnungsgeber")} />}>
        <FileText className="size-4" />
        {t("wohnungsgeber")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("wohnungsgeber")}</DialogTitle>
        </DialogHeader>
        <form
          method="get"
          action={`/api/leases/${leaseId}/wohnungsgeber`}
          target="_blank"
          onSubmit={() => setOpen(false)}
          className="space-y-4"
        >
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
          <Button type="submit" className="w-full">
            <FileText className="size-4" /> {t("wgCreate")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
