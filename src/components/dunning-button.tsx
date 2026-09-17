"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createDunning } from "@/server/actions/finances";
import { Button } from "@/components/ui/button";

// Nächste Mahnstufe. Bei zu frühem Versuch (14-Tage-Frist) zeigt die Server-
// Action einen Hinweis, der hier als Popup (Toast) erscheint.
export function DunningButton({ chargeId }: { chargeId: string }) {
  const t = useTranslations("finances");
  const router = useRouter();
  const [pending, start] = useTransition();

  function run() {
    const fd = new FormData();
    fd.set("chargeId", chargeId);
    start(async () => {
      const res = await createDunning({}, fd);
      if (res.error) toast.error(res.error);
      else {
        toast.success(t("dunCreated"));
        router.refresh();
      }
    });
  }

  return (
    <Button type="button" onClick={run} disabled={pending} variant="ghost" size="icon" aria-label={t("dun")}>
      <Bell className="size-4" />
    </Button>
  );
}
