"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Coins, Mail } from "lucide-react";
import { bookStatementCharges, emailStatementToTenants } from "@/server/actions/statement-actions";
import type { ActionState } from "@/lib/schemas";
import { Button } from "@/components/ui/button";

export function StatementActions({ propertyId, year }: { propertyId: string; year: number }) {
  const t = useTranslations("statements");
  const [bookState, book, booking] = useActionState<ActionState, FormData>(bookStatementCharges, {});
  const [mailState, mail, mailing] = useActionState<ActionState, FormData>(emailStatementToTenants, {});

  useEffect(() => {
    if (bookState.ok) toast.success(t("charged"));
    else if (bookState.error) toast.error(bookState.error);
  }, [bookState, t]);
  useEffect(() => {
    if (mailState.ok) toast.success(t("mailed"));
    else if (mailState.error) toast.error(mailState.error);
  }, [mailState, t]);

  return (
    <div className="flex flex-wrap gap-2">
      <form action={book}>
        <input type="hidden" name="propertyId" value={propertyId} />
        <input type="hidden" name="year" value={year} />
        <Button type="submit" size="sm" variant="outline" disabled={booking}>
          <Coins className="size-4" />
          {t("bookCharges")}
        </Button>
      </form>
      <form action={mail}>
        <input type="hidden" name="propertyId" value={propertyId} />
        <input type="hidden" name="year" value={year} />
        <Button type="submit" size="sm" variant="outline" disabled={mailing}>
          <Mail className="size-4" />
          {t("mailTenants")}
        </Button>
      </form>
    </div>
  );
}
