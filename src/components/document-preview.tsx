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

// Zeigt ein Dokument (PDF/Bild/XML/Text) direkt im Browser per <iframe>.
export function DocumentPreview({ id, name }: { id: string; name: string }) {
  const t = useTranslations("documents");
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon" aria-label={t("preview")}>
            <Eye className="size-4" />
          </Button>
        }
      />
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="truncate">{name}</DialogTitle>
        </DialogHeader>
        {open && (
          <iframe
            src={`/api/documents/${id}?inline=1`}
            title={name}
            className="h-[70vh] w-full rounded-md border bg-white"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
