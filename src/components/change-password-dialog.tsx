"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { changePassword } from "@/server/actions/account";
import type { ActionState } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TextField } from "@/components/form-fields";

export function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const t = useTranslations("account");
  const [state, formAction, pending] = useActionState<ActionState, FormData>(changePassword, {});

  useEffect(() => {
    if (state.ok) {
      onOpenChange(false);
      toast.success(t("changed"));
    }
  }, [state, onOpenChange, t]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("changePassword")}</DialogTitle>
        </DialogHeader>
        <form action={formAction} key={open ? "open" : "closed"} className="space-y-4">
          <TextField name="current" label={t("current")} type="password" />
          <TextField name="next" label={t("new")} type="password" />
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {t("changePassword")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
