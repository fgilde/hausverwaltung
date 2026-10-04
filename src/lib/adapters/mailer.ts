import "server-only";
import nodemailer from "nodemailer";

// Mail-Versand über SMTP. Konfiguration kommt aus der Mandanten-Einstellung
// und fällt sonst auf ENV (SMTP_HOST, SMTP_PORT, …) zurück.

export interface SmtpConfig {
  host?: string | null;
  port?: number | null;
  user?: string | null;
  password?: string | null;
  from?: string | null;
  secure?: boolean | null;
}

function resolve(cfg?: SmtpConfig) {
  const host = cfg?.host || process.env.SMTP_HOST || "";
  const port = cfg?.port ?? (process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587);
  const user = cfg?.user || process.env.SMTP_USER || "";
  const password = cfg?.password || process.env.SMTP_PASSWORD || "";
  const from = cfg?.from || process.env.SMTP_FROM || user;
  const secure = cfg?.secure ?? port === 465;
  return { host, port, user, password, from, secure };
}

/** Effektive Absenderadresse (Mandant oder ENV), z. B. für die Anzeige (#44). */
export function smtpFromAddress(cfg?: SmtpConfig): string {
  return resolve(cfg).from;
}

export function isMailerConfigured(cfg?: SmtpConfig): boolean {
  return !!resolve(cfg).host;
}

function transporter(cfg?: SmtpConfig) {
  const c = resolve(cfg);
  return {
    transport: nodemailer.createTransport({
      host: c.host,
      port: c.port,
      secure: c.secure,
      auth: c.user ? { user: c.user, pass: c.password } : undefined,
    }),
    from: c.from,
  };
}

export interface MailAttachment {
  filename: string;
  content: Buffer;
}

export interface OutgoingMail {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  body: string;
  html?: string | null; // formatierte Fassung (#56), body bleibt die Text-Variante
  attachments?: MailAttachment[];
  messageId?: string; // eigene Message-ID, damit Antworten zugeordnet werden (#43)
  references?: string[]; // Vorgänger-IDs; die letzte wird In-Reply-To
}

/** Versendet eine Mail über den konfigurierten SMTP-Server. Wirft bei Fehler. */
export async function sendMail(mail: OutgoingMail, cfg?: SmtpConfig): Promise<void> {
  if (!isMailerConfigured(cfg)) return; // ohne Konfiguration: lokale Queue, kein Versand
  const { transport, from } = transporter(cfg);
  await transport.sendMail({
    from,
    to: mail.to,
    cc: mail.cc,
    bcc: mail.bcc,
    subject: mail.subject,
    text: mail.body,
    html: mail.html ?? undefined,
    attachments: mail.attachments,
    messageId: mail.messageId,
    inReplyTo: mail.references?.at(-1),
    references: mail.references?.length ? mail.references : undefined,
  });
}

/** Prüft die SMTP-Verbindung (für den Test-Button in den Einstellungen). */
export async function verifyMailer(cfg?: SmtpConfig): Promise<void> {
  if (!isMailerConfigured(cfg)) throw new Error("Kein SMTP-Host konfiguriert");
  const { transport } = transporter(cfg);
  await transport.verify();
}
