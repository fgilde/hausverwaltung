import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

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
  fromAddress: string;
  fromName: string | null;
  subject: string | null;
  body: string;
  receivedAt: Date;
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
 * Nur Kopf + Textkörper, keine Anhänge.
 */
export async function fetchInbox(cfg: ImapConfig | undefined, since: Date, limit = 200): Promise<FetchedMail[]> {
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
          fromAddress: fromAddr.address,
          fromName: fromAddr.name || null,
          subject: p.subject ?? null,
          body: (p.text ?? "").trim() || (p.html ? String(p.html).replace(/<[^>]+>/g, " ").trim() : ""),
          receivedAt: p.date ?? new Date(),
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
