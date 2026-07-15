"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { askAssistantAction, type AssistantState } from "@/server/actions/ai";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function AiAssistant() {
  const t = useTranslations("assistant");
  const [state, formAction, pending] = useActionState<AssistantState, FormData>(
    askAssistantAction,
    {},
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4" />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <form action={formAction} className="flex flex-col gap-2 sm:flex-row">
          <input
            name="question"
            placeholder={t("placeholder")}
            className={cn(
              "flex h-9 flex-1 rounded-lg border border-input bg-transparent px-3 text-sm shadow-xs",
              "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none",
              "dark:bg-input/30",
            )}
          />
          <Button type="submit" disabled={pending}>
            {pending ? t("thinking") : t("ask")}
          </Button>
        </form>
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        {state.answer && (
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm whitespace-pre-wrap">
            {state.answer}
          </div>
        )}
        {state.configured === false && (
          <p className="text-xs text-muted-foreground">{t("notConfigured")}</p>
        )}
      </CardContent>
    </Card>
  );
}
