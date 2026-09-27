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
