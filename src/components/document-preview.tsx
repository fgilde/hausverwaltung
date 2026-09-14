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

// Mudex File-Display rendert PDF, Bilder, Office-Dokumente, Markdown und Audio.
const MUDEX_SCRIPT = "https://www.mudex.org/wc/mudex.js";

// Für HTML-Attribut-Kontext escapen (Dateiname/MIME/URL stammen aus DB).
function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Der Viewer läuft in einem isolierten iframe (srcdoc): Mudex bringt globale
// Styles mit, die sonst nach dem Schließen das App-Layout zerlegen würden.
function buildSrcDoc(url: string, mime: string, name: string) {
  return `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;height:100%;background:#fff}mudex-file-display{display:block;width:100%;height:100vh}</style>
<script src="${MUDEX_SCRIPT}"></script></head>
<body><mudex-file-display url="${esc(url)}" content-type="${esc(mime)}" file-name="${esc(name)}" show-file-name="true"></mudex-file-display></body></html>`;
}

export function DocumentPreview({ id, name, mime }: { id: string; name: string; mime: string }) {
  const t = useTranslations("documents");
  const [open, setOpen] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
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
            srcDoc={buildSrcDoc(`${origin}/api/documents/${id}?inline=1`, mime, name)}
            sandbox="allow-scripts allow-same-origin"
            className="h-[80vh] w-full rounded-md border bg-white"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
