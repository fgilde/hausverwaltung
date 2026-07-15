"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { BellPlus } from "lucide-react";
import { generateReminders } from "@/server/actions/reminders";
import type { ActionState } from "@/lib/schemas";
import { Button } from "@/components/ui/button";

export function ReminderButton() {
  const t = useTranslations("dashboard");
  const [state, action, pending] = useActionState<ActionState, FormData>(generateReminders, {});

  useEffect(() => {
    if (state.ok) toast.success(t("remindersCreated"));
    else if (state.error) toast.error(state.error);
  }, [state, t]);

  return (
    <form action={action}>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        <BellPlus className="size-4" />
        {t("generateReminders")}
      </Button>
    </form>
  );
}
