"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";
import { syncInbox } from "@/server/actions/inbound";
import type { ActionState } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Postfach jetzt abrufen, direkt im Posteingang (#43).
export function InboxSyncButton() {
  const t = useTranslations("config");
  const [res, action, pending] = useActionState<ActionState, FormData>(syncInbox, {});
  return (
    <form action={action} className="flex items-center gap-2">
      {res.error && <span className={cn("text-xs", res.ok ? "text-muted-foreground" : "text-destructive")}>{res.error}</span>}
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        <RefreshCw className={cn("size-4", pending && "animate-spin")} /> {pending ? t("syncing") : t("syncNow")}
      </Button>
    </form>
  );
}
