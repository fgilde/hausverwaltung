// E-Mail-Benachrichtigungen (#77): je Art im Mandanten schaltbar (Tenant.notifyEmail).

export const NOTIFY_KINDS = [
  "RENT_OVERDUE", // Miete nach Fälligkeit nicht (vollständig) bezahlt
  "PAYMENTS_IN", // neue Zahlungseingänge
  "PAYMENTS_OUT", // neue Zahlungsausgänge
  "LETTER_SENT", // Brief versendet
  "LETTER_DELIVERED", // Brief zugestellt
  "LETTER_FAILED", // Briefversand fehlgeschlagen
  "APPOINTMENT_DAY", // Terminerinnerung einen Tag vorher
  "APPOINTMENT_HOUR", // Terminerinnerung eine Stunde vorher
  "APPOINTMENT_PERSONS", // Erinnerung auch an die Teilnehmer des Termins
  "ISSUE_REPORTED", // Schadensmeldung aus dem Mieterportal
  "INBOUND_EMAIL", // neue eingegangene E-Mails
  "TICKET_REPORTER", // Mieter über Änderungen an ihren Schadensmeldungen informieren (#100)
] as const;
export type NotifyKind = (typeof NOTIFY_KINDS)[number];

export const isNotifyKind = (v: string): v is NotifyKind => (NOTIFY_KINDS as readonly string[]).includes(v);

export const DAY_MS = 86_400_000;
export const HOUR_MS = 3_600_000;

/**
 * Fällt ein Zeitpunkt minus Vorlauf in das Prüffenster (prev, now]? So erinnert jeder
 * Lauf genau einmal, auch wenn ein Lauf ausfällt (das nächste Fenster schließt an).
 */
export function inWindow(at: Date, leadMs: number, prev: Date, now: Date) {
  const t = at.getTime() - leadMs;
  return t > prev.getTime() && t <= now.getTime();
}

/** Fenster für Termine mit Vorlauf: Beginn in (prev + lead, now + lead]. */
export function leadRange(leadMs: number, prev: Date, now: Date) {
  return { gt: new Date(prev.getTime() + leadMs), lte: new Date(now.getTime() + leadMs) };
}

/** Sammelmail-Text: Kopfzeile plus höchstens `max` Einträge, Rest als „… und N weitere“. */
export function digest(head: string, items: string[], max = 20) {
  const shown = items.slice(0, max).map((i) => `• ${i}`);
  if (items.length > max) shown.push(`… und ${items.length - max} weitere`);
  return [head, "", ...shown].join("\n");
}
