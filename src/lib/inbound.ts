// Reine Helfer für den E-Mail-Eingang (#39). Kein IO — testbar.

export interface ParsedInbound {
  messageId: string | null;
  fromAddress: string;
  subject: string | null;
  receivedAt: Date;
}

/**
 * Stabiler Dedup-Schlüssel je Nachricht: die Message-ID, sonst ein Fallback aus
 * Absender + Zeitpunkt + Betreff (manche Mails haben keine Message-ID).
 */
export function dedupKey(m: ParsedInbound): string {
  if (m.messageId && m.messageId.trim()) return m.messageId.trim();
  return `${m.fromAddress.toLowerCase()}|${m.receivedAt.toISOString()}|${m.subject ?? ""}`;
}

/** Sync-Intervall auf sinnvolle Grenzen (5 Min … 24 h) begrenzen. */
export function clampSyncInterval(min: number | null | undefined): number {
  const n = Math.round(Number(min));
  if (!Number.isFinite(n) || n <= 0) return 30;
  return Math.min(1440, Math.max(5, n));
}

/** Ist ein automatischer Abruf fällig? Noch nie synchronisiert → ja. */
export function isSyncDue(lastSyncAt: Date | null, intervalMin: number, now: Date = new Date()): boolean {
  if (!lastSyncAt) return true;
  return now.getTime() - lastSyncAt.getTime() >= clampSyncInterval(intervalMin) * 60_000;
}

/**
 * Ordnet eine Absenderadresse einer Person zu (exakter, case-insensitiver
 * E-Mail-Vergleich). Gibt die Personen-ID zurück oder null.
 */
export function matchPersonId(
  fromAddress: string,
  persons: { id: string; email: string | null }[],
): string | null {
  const addr = fromAddress.trim().toLowerCase();
  if (!addr) return null;
  const hit = persons.find((p) => (p.email ?? "").trim().toLowerCase() === addr);
  return hit ? hit.id : null;
}

export interface MailAttachment {
  filename?: string | null;
  contentType: string;
  size: number;
  related?: boolean; // eingebettetes Bild (cid, z. B. Signatur-Logo)
}

// ponytail: feste Obergrenze je Mail, Setting erst wenn jemand mehr braucht.
export const MAX_ATTACHMENTS_PER_MAIL = 20;

/** Anhänge-Größe (MB) aus dem Setting auf 1 … 50 MB begrenzen. */
export function clampAttachMaxMb(mb: number | null | undefined): number {
  const n = Math.round(Number(mb));
  if (!Number.isFinite(n) || n <= 0) return 10;
  return Math.min(50, Math.max(1, n));
}

/**
 * Welche Anhänge einer eingehenden Mail gespeichert werden: keine eingebetteten
 * Bilder, nur bis `maxBytes` je Datei und höchstens MAX_ATTACHMENTS_PER_MAIL.
 */
export function selectAttachments<T extends MailAttachment>(list: T[], maxBytes: number): T[] {
  return list
    .filter((a) => !a.related && a.size > 0 && a.size <= maxBytes)
    .slice(0, MAX_ATTACHMENTS_PER_MAIL);
}

// ---------- Unterhaltungen (Threads, #43) ----------

const REPLY_PREFIX = /^\s*(re|aw|antw|wg|fw|fwd)\s*(\[\d+\])?\s*:\s*/i;

/** Ist der Betreff eine Antwort/Weiterleitung („Re:“, „AW:“, „WG:“ …)? */
export function isReplySubject(subject: string | null | undefined): boolean {
  return REPLY_PREFIX.test(subject ?? "");
}

/** Betreff ohne Antwort-Präfixe, klein geschrieben, für den Vergleich. */
export function normalizeSubject(subject: string | null | undefined): string {
  let s = subject ?? "";
  while (REPLY_PREFIX.test(s)) s = s.replace(REPLY_PREFIX, "");
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Alle Message-IDs (`<…>`) aus In-Reply-To/References, ohne Doppelte. */
export function refIds(...headers: (string | string[] | null | undefined)[]): string[] {
  const ids = headers.flat().join(" ").match(/<[^<>\s]+>/g) ?? [];
  return [...new Set(ids)];
}

/** Eigene Message-ID für eine ausgehende Mail, Domain aus der Absenderadresse. */
export function messageIdFor(id: string, from: string | null | undefined): string {
  const domain = /@([^>\s]+)/.exec(from ?? "")?.[1] ?? "havewa.local";
  return `<${id}@${domain}>`;
}

/** Schlüssel der Unterhaltung: gesetzte threadId, sonst die eigene id. */
export function threadKey(m: { id: string; threadId: string | null }): string {
  return m.threadId ?? m.id;
}
