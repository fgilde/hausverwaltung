import { cn } from "@/lib/utils";

/**
 * Mail-Inhalt anzeigen (#56): formatierte Mails als HTML, sonst Text. Das HTML
 * wurde beim Speichern serverseitig bereinigt (server/mail-sanitize.ts).
 */
export function MailBody({ html, text, className }: { html?: string | null; text: string; className?: string }) {
  if (html) return <div className={cn("mail-html text-sm", className)} dangerouslySetInnerHTML={{ __html: html }} />;
  return <div className={cn("whitespace-pre-wrap text-sm", className)}>{text || "—"}</div>;
}
