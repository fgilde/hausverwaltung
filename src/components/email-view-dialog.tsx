"use client";

import { Eye, Paperclip } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Attachment = { id: string; name: string };

// Postausgang: E-Mail-Text und Anhänge einsehen (#34).
export function EmailViewDialog({
  message,
}: {
  message: {
    toAddress: string;
    cc: string | null;
    subject: string;
    body: string;
    attachments: Attachment[];
  };
}) {
  const t = useTranslations();
  return (
    <Dialog>
      <DialogTrigger
        render={<Button variant="ghost" size="icon" aria-label={t("email.view")} title={t("email.view")} />}
      >
        <Eye className="size-4" />
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">{message.subject}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="text-muted-foreground">
            <div>
              <span className="font-medium text-foreground">{t("email.to")}:</span> {message.toAddress}
            </div>
            {message.cc ? (
              <div>
                <span className="font-medium text-foreground">Cc:</span> {message.cc}
              </div>
            ) : null}
          </div>
          <div className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3">
            {message.body}
          </div>
          {message.attachments.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <Paperclip className="size-4" /> {t("email.attachments")}
              </div>
              <div className="space-y-1">
                {message.attachments.map((a) => (
                  <a
                    key={a.id}
                    href={`/api/documents/${a.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate rounded px-2 py-1 text-sm hover:bg-muted hover:underline"
                  >
                    {a.name}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
