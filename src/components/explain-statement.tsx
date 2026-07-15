"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { explainStatement, type AssistantState } from "@/server/actions/ai";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ExplainStatement({ propertyId, year }: { propertyId: string; year: number }) {
  const t = useTranslations("statements");
  const [state, action, pending] = useActionState<AssistantState, FormData>(explainStatement, {});
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (state.answer || state.error) setOpen(true);
  }, [state]);

  return (
    <>
      <form action={action}>
        <input type="hidden" name="propertyId" value={propertyId} />
        <input type="hidden" name="year" value={year} />
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          <Sparkles className="size-4" />
          {pending ? t("explaining") : t("explain")}
        </Button>
      </form>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("explain")}</DialogTitle>
          </DialogHeader>
          {state.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : (
            <div className="max-h-[60vh] overflow-auto text-sm whitespace-pre-wrap">{state.answer}</div>
          )}
          {state.configured === false && (
            <p className="text-xs text-muted-foreground">{t("explainHint")}</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
