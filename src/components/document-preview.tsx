"use client";

import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Mudex File-Display: rendert PDF, Bilder, Office-Dokumente, Markdown und Audio.
const MUDEX_SCRIPT = "https://www.mudex.org/wc/mudex.js";

// Lädt das Web-Component-Script einmalig, sobald ein Dialog erstmals geöffnet wird.
function useMudexScript(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;
    if (document.querySelector(`script[src="${MUDEX_SCRIPT}"]`)) return;
    const s = document.createElement("script");
    s.src = MUDEX_SCRIPT;
    s.async = true;
    document.head.appendChild(s);
  }, [enabled]);
}

// Zeigt ein Dokument im Dialog über die Mudex-Komponente (Fallback: Datei laden).
export function DocumentPreview({ id, name, mime }: { id: string; name: string; mime: string }) {
  const t = useTranslations("documents");
  const [open, setOpen] = useState(false);
  useMudexScript(open);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon" aria-label={t("preview")} title={t("preview")}>
            <Eye className="size-4" />
          </Button>
        }
      />
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="truncate">{name}</DialogTitle>
        </DialogHeader>
        {open && (
          <div className="h-[70vh] w-full overflow-hidden rounded-md border bg-white">
            <mudex-file-display
              url={`/api/documents/${id}?inline=1`}
              content-type={mime}
              file-name={name}
              show-file-name="true"
              style={{ display: "block", width: "100%", height: "100%" }}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
