"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation"; // push mit Sprachpräfix
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function DeleteButton({
  action,
  id,
  label,
  description,
  redirectTo,
}: {
  action: (fd: FormData) => Promise<void>;
  id: string;
  label?: string; // z. B. „Verbindung trennen“ statt „Löschen“ (#53)
  description?: string;
  redirectTo?: string; // nach dem Löschen dorthin (z. B. gelöschte Unterhaltung, #50)
}) {
  const t = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function confirm() {
    const fd = new FormData();
    fd.set("id", id);
    start(async () => {
      try {
        await action(fd);
        setOpen(false);
        toast.success(t("deleted"));
        if (redirectTo) router.push(redirectTo);
        else router.refresh(); // abhängige Übersichten sofort aktualisieren
      } catch {
        toast.error(t("deleteFailed"));
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button variant="ghost" size="icon" aria-label={label ?? t("delete")} title={label ?? t("delete")}>
            <Trash2 className="size-4" />
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{label ? `${label}?` : t("deleteTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{description ?? t("deleteDesc")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            type="button"
            onClick={confirm}
            disabled={pending}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {label ?? t("delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
