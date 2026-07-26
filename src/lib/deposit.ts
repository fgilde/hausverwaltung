// Kautionsverzinsung (einfache Zinsen, taggenau).

const DAY = 86_400_000;

/**
 * Zins auf die Kaution über die Haltedauer.
 * @param amount Kautionsbetrag
 * @param ratePct Zinssatz % p.a. (null/0 = kein Zins)
 * @param from Erhalten am
 * @param to Rückzahlung/Stichtag (default: from, wenn null → 0 Tage)
 */
export function depositInterest(
  amount: number,
  ratePct: number | null | undefined,
  from: Date | null | undefined,
  to: Date | null | undefined,
): number {
  if (!ratePct || !from) return 0;
  const end = to ?? new Date();
  const days = Math.max(0, Math.floor((end.getTime() - from.getTime()) / DAY));
  const interest = (amount * ratePct * days) / (100 * 365);
  return Math.round(interest * 100) / 100;
}
