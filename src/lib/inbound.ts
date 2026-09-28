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
