"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, Printer, Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createDunning, emailDunning } from "@/server/actions/finances";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Bündelt Erstellen + Drucken + Versenden einer Mahnung in einem Popup (#28).
// Die Mahnung wird beim ersten Aktions-Klick erstellt (14-Tage-Sperre greift),
// weitere Aktionen im selben Dialog nutzen dieselbe Mahnung (kein Doppel-Level).
export function DunningDialog({
  chargeId,
  renterName,
  hasEmail,
}: {
  chargeId: string;
  renterName: string;
  hasEmail: boolean;
}) {
  const t = useTranslations("finances");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState(false);
  const [pending, start] = useTransition();

  function form() {
    const fd = new FormData();
    fd.set("chargeId", chargeId);
    return fd;
  }

  // Mahnung genau einmal je Dialog-Öffnung erstellen; Fehler (z. B. 14-Tage-Sperre)
  // stoppt die Aktion. Gibt true zurück, wenn eine Mahnung vorliegt.
  async function ensureCreated(): Promise<boolean> {
    if (created) return true;
    const res = await createDunning({}, form());
    if (res.error) {
      toast.error(res.error);
      return false;
    }
    setCreated(true);
    return true;
  }

  function onOpenChange(v: boolean) {
    setOpen(v);
    if (!v) setCreated(false);
  }

  const doPrint = () =>
    start(async () => {
      if (!(await ensureCreated())) return;
      window.open(`/api/dunning/${chargeId}/pdf`, "_blank", "noopener");
      router.refresh();
    });

  const doEmail = () =>
    start(async () => {
      if (!hasEmail) {
        toast.error(t("dunNoEmail"));
        return;
      }
      if (!(await ensureCreated())) return;
      const res = await emailDunning({}, form());
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("dunEmailed"));
      onOpenChange(false);
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={<Button variant="ghost" size="icon" aria-label={t("dun")} title={t("dun")} />}
      >
        <Bell className="size-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("dunTitle")}</DialogTitle>
          <DialogDescription>{t("dunConfirm", { name: renterName || "—" })}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost" disabled={pending} />}>{t("dunCancel")}</DialogClose>
          <Button variant="outline" onClick={doPrint} disabled={pending}>
            <Printer className="size-4" /> {t("dunPrint")}
          </Button>
          <Button onClick={doEmail} disabled={pending || !hasEmail} title={hasEmail ? undefined : t("dunNoEmail")}>
            <Mail className="size-4" /> {t("dunEmail")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
