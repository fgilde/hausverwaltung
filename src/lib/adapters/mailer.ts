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

export interface OutgoingMail {
  to: string;
  subject: string;
  body: string;
}

/** Versendet eine Mail über den konfigurierten SMTP-Server. Wirft bei Fehler. */
export async function sendMail(mail: OutgoingMail, cfg?: SmtpConfig): Promise<void> {
  if (!isMailerConfigured(cfg)) return; // ohne Konfiguration: lokale Queue, kein Versand
  const { transport, from } = transporter(cfg);
  await transport.sendMail({ from, to: mail.to, subject: mail.subject, text: mail.body });
}

/** Prüft die SMTP-Verbindung (für den Test-Button in den Einstellungen). */
export async function verifyMailer(cfg?: SmtpConfig): Promise<void> {
  if (!isMailerConfigured(cfg)) throw new Error("Kein SMTP-Host konfiguriert");
  const { transport } = transporter(cfg);
  await transport.verify();
}
