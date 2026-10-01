"use client";

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
import { MailAttachmentList, type ImportDefaults } from "@/components/mail-attachments";
import type { MailAttachment } from "@/lib/mail-attachments";
import { markInboundRead } from "@/server/actions/inbound";

// E-Mail-Text und Anhänge einsehen: Postausgang (#34) und Kommunikationsverlauf
// eines Kontakts, ein- wie ausgehend (#39).
export function EmailViewDialog({
  message,
  markReadId,
  inbound,
  importDefaults,
}: {
  message: {
    from?: string | null;
    toAddress?: string | null;
    cc?: string | null;
    date?: string | null;
    subject: string;
    body: string;
    attachments: MailAttachment[];
  };
  inbound?: boolean; // eingehende Mail: Anhänge lassen sich übernehmen (#52)
  importDefaults?: ImportDefaults;
  markReadId?: string; // ungelesene eingehende Mail: beim Öffnen als gelesen markieren (#43)
}) {
  const t = useTranslations();
  return (
    <Dialog onOpenChange={(open) => open && markReadId && markInboundRead(markReadId)}>
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
            {message.from ? (
              <div>
                <span className="font-medium text-foreground">{t("email.from")}:</span> {message.from}
              </div>
            ) : null}
            {message.toAddress ? (
              <div>
                <span className="font-medium text-foreground">{t("email.to")}:</span> {message.toAddress}
              </div>
            ) : null}
            {message.cc ? (
              <div>
                <span className="font-medium text-foreground">Cc:</span> {message.cc}
              </div>
            ) : null}
            {message.date ? <div>{message.date}</div> : null}
          </div>
          <div className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3">
            {message.body || "—"}
          </div>
          <MailAttachmentList attachments={message.attachments} inbound={inbound} defaults={importDefaults} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
