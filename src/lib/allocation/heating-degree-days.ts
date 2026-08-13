// HeizkostenV §9b: Gradtagszahlen-Tabelle zur Hochrechnung des Verbrauchs bei
// unterjährigen Ableseperioden (z. B. Mieterwechsel). Monatsanteile am
// Jahres-Heizbedarf in Promille (Anlage zu §9b), Summe = 1000.
const PROMILLE = [170, 150, 130, 80, 30, 0, 0, 0, 30, 90, 130, 190];

/**
 * Anteil des Jahres-Heizbedarfs im Zeitraum [start, end] (inklusive), 0..1.
 * Tagesgenau: Monatspromille gleichmäßig auf die Monatstage verteilt.
 */
export function degreeDayFraction(start: Date, end: Date): number {
  if (end.getTime() < start.getTime()) return 0;
  let sum = 0;
  const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  while (d.getTime() <= last) {
    const m = d.getUTCMonth();
    const daysInMonth = new Date(Date.UTC(d.getUTCFullYear(), m + 1, 0)).getUTCDate();
    sum += PROMILLE[m] / daysInMonth;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return sum / 1000;
}

/**
 * Rechnet einen in [start, end] gemessenen Heiz-/Warmwasserverbrauch auf einen
 * Jahreswert hoch (HeizkostenV §9b). Deckt der Zeitraum kaum Heizbedarf ab
 * (<5 %), wird nicht hochgerechnet (Division vermeiden).
 */
export function extrapolateConsumption(measured: number, start: Date, end: Date): number {
  const f = degreeDayFraction(start, end);
  return f > 0.05 ? measured / f : measured;
}
