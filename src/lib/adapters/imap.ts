import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { selectAttachments, refIds } from "@/lib/inbound";

// Eingehende Mails per IMAP abrufen (Kommunikationsverlauf, #39). Konfiguration
// je Mandant (Einstellungen), sonst ENV-Fallback.

export interface ImapConfig {
  host?: string | null;
  port?: number | null;
  user?: string | null;
  password?: string | null;
  secure?: boolean | null;
  mailbox?: string | null;
}

export interface FetchedMail {
  messageId: string | null;
  references: string[]; // Message-IDs aus In-Reply-To/References (Threads, #43)
  fromAddress: string;
  fromName: string | null;
  subject: string | null;
  body: string;
  receivedAt: Date;
  attachments: FetchedAttachment[];
}

export interface FetchedAttachment {
  filename: string;
  contentType: string;
  size: number;
  content: Buffer;
}

function resolve(cfg?: ImapConfig) {
  const host = cfg?.host || process.env.IMAP_HOST || "";
  const port = cfg?.port ?? (process.env.IMAP_PORT ? Number(process.env.IMAP_PORT) : 993);
  const user = cfg?.user || process.env.IMAP_USER || "";
  const password = cfg?.password || process.env.IMAP_PASSWORD || "";
  const secure = cfg?.secure ?? port === 993;
  const mailbox = cfg?.mailbox || process.env.IMAP_MAILBOX || "INBOX";
  return { host, port, user, password, secure, mailbox };
}

/** Postfach-Adresse für die Anzeige (#44): der IMAP-Login, sofern er eine Adresse ist. */
export function imapAddress(cfg?: ImapConfig): string {
  const { user } = resolve(cfg);
  return user.includes("@") ? user : "";
}

export function isImapConfigured(cfg?: ImapConfig): boolean {
  const c = resolve(cfg);
  return !!(c.host && c.user);
}

function client(cfg?: ImapConfig): { imap: ImapFlow; mailbox: string } {
  const c = resolve(cfg);
  return {
    imap: new ImapFlow({ host: c.host, port: c.port, secure: c.secure, auth: { user: c.user, pass: c.password }, logger: false }),
    mailbox: c.mailbox,
  };
}

/** Verbindungstest: verbinden, Postfach öffnen, wieder schließen. Wirft bei Fehler. */
export async function verifyImap(cfg?: ImapConfig): Promise<void> {
  const { imap, mailbox } = client(cfg);
  await imap.connect();
  try {
    const lock = await imap.getMailboxLock(mailbox);
    lock.release();
  } finally {
    await imap.logout().catch(() => {});
  }
}

/**
 * Holt Nachrichten seit `since` (max. `limit`, neueste zuerst) aus dem Postfach.
 * Anhänge nur, wenn `attachMaxBytes` > 0 (ohne eingebettete Bilder, je Datei
 * höchstens `attachMaxBytes`), sonst nur Kopf + Textkörper.
 */
export async function fetchInbox(
  cfg: ImapConfig | undefined,
  since: Date,
  { limit = 200, attachMaxBytes = 0 }: { limit?: number; attachMaxBytes?: number } = {},
): Promise<FetchedMail[]> {
  const { imap, mailbox } = client(cfg);
  const out: FetchedMail[] = [];
  await imap.connect();
  try {
    const lock = await imap.getMailboxLock(mailbox);
    try {
      const uids = await imap.search({ since }, { uid: true });
      if (!uids || uids.length === 0) return out;
      const take = uids.slice(-limit); // neueste
      for await (const msg of imap.fetch(take, { uid: true, source: true }, { uid: true })) {
        if (!msg.source) continue;
        const p = await simpleParser(msg.source as Buffer);
        const fromAddr = p.from?.value?.[0];
        if (!fromAddr?.address) continue;
        out.push({
          messageId: p.messageId ?? null,
          references: refIds(p.inReplyTo, p.references),
          fromAddress: fromAddr.address,
          fromName: fromAddr.name || null,
          subject: p.subject ?? null,
          body: (p.text ?? "").trim() || (p.html ? String(p.html).replace(/<[^>]+>/g, " ").trim() : ""),
          receivedAt: p.date ?? new Date(),
          attachments: attachMaxBytes > 0
            ? selectAttachments(p.attachments ?? [], attachMaxBytes).map((a, i) => ({
                filename: a.filename || `anhang-${i + 1}`,
                contentType: a.contentType || "application/octet-stream",
                size: a.size,
                content: a.content,
              }))
            : [],
        });
      }
    } finally {
      lock.release();
    }
  } finally {
    await imap.logout().catch(() => {});
  }
  // neueste zuerst
  return out.sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
}
