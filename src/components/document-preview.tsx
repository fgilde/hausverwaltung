"use client";

import { useState } from "react";
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

// Vorschau über Mudex File-Display (PDF, Bilder, Office, Markdown, Audio).
// Läuft in einem iframe auf eine echte same-origin URL (/viewer): isoliert die
// globalen Mudex-Styles vom App-Layout und gibt der Blazor-WASM-Komponente eine
// gültige Base-URI (srcdoc/about:srcdoc scheitert an Blazor).
export function DocumentPreview({ id, name, mime }: { id: string; name: string; mime: string }) {
  const t = useTranslations("documents");
  const [open, setOpen] = useState(false);
  const src = `/api/documents/${id}/viewer?mime=${encodeURIComponent(mime)}&name=${encodeURIComponent(name)}`;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon" aria-label={t("preview")} title={t("preview")}>
            <Eye className="size-4" />
          </Button>
        }
      />
      <DialogContent className="w-[95vw] max-w-[1100px] sm:max-w-[1100px]">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">{name}</DialogTitle>
        </DialogHeader>
        {open && (
          <iframe
            title={name}
            src={src}
            sandbox="allow-scripts allow-same-origin allow-downloads"
            className="h-[80vh] w-full rounded-md border bg-white"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
