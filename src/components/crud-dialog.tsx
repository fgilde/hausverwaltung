"use client";

import * as React from "react";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { outboxToast } from "@/components/outbox-toast";
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
  extraActions,
  children,
}: {
  trigger: React.ReactElement;
  title: string;
  action: Action;
  submitLabel?: string;
  extraActions?: React.ReactNode; // weitere Submit-Buttons, z. B. „Als Entwurf speichern“
  children: React.ReactNode;
}) {
  const t = useTranslations("common");
  const tRoot = useTranslations();
  const router = useRouter();
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

  // Erfolg genau EINMAL je Absenden behandeln. Ohne den Ref-Guard feuerte der
  // Effekt bei jedem Re-Render (durch router.refresh) erneut → Toast-Endlosschleife.
  const handledState = useRef<ActionState | null>(null);
  useEffect(() => {
    if (state.ok && handledState.current !== state) {
      handledState.current = state;
      setOpen(false);
      outboxToast(tRoot, state.notice, state.error ?? t("saved")); // ok + error = Zusammenfassung (Import)
      router.refresh(); // abhängige Übersichten sofort aktualisieren
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      {/* nie höher als das Fenster: lange Formulare (z. B. Ticket mit Melder-Nachricht) scrollen */}
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {/* key remountet Formular je Öffnung → frische Felder */}
        <form action={formAction} key={open ? "open" : "closed"} className="space-y-4">
          {children}
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            {extraActions}
            <Button type="submit" disabled={pending}>
              {submitLabel ?? t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
