"use client";

import { Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** Öffnet den Druckdialog des Browsers → "Als PDF speichern". Im Druck ausgeblendet. */
export function PrintButton() {
  const t = useTranslations("print");
  return (
    <Button size="sm" onClick={() => window.print()} className="print:hidden">
      <Printer className="size-4" />
      {t("printPdf")}
    </Button>
  );
}
