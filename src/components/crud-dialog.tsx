"use client";

import * as React from "react";
import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { ActionState } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

export function CrudDialog({
  trigger,
  title,
  action,
  submitLabel,
  children,
}: {
  trigger: React.ReactElement;
  title: string;
  action: Action;
  submitLabel?: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  // Wirft die Server-Action (statt {error} zurückzugeben), blieb der Dialog
  // sonst offen ohne Hinweis. Fehler abfangen und anzeigen; echte Redirects
  // (NEXT_REDIRECT, z. B. Login-Guard) müssen durchgereicht werden.
  const safeAction: Action = async (prev, fd) => {
    try {
      return await action(prev, fd);
    } catch (e) {
      if (e && typeof e === "object" && "digest" in e && String((e as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")) {
        throw e;
      }
      return { error: e instanceof Error ? e.message : t("actionFailed") };
    }
  };
  const [state, formAction, pending] = useActionState<ActionState, FormData>(safeAction, {});

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      toast.success(t("saved"));
    }
  }, [state, t]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {/* key remountet Formular je Öffnung → frische Felder */}
        <form action={formAction} key={open ? "open" : "closed"} className="space-y-4">
          {children}
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {submitLabel ?? t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
