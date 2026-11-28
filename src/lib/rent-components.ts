// Mietbestandteile mit Gültigkeit (#87): gilt ab effectiveDate bis endDate, beides optional
// (leer = seit Vertragsbeginn bzw. unbefristet). Gerechnet wird monatsweise: ein Bestandteil
// zählt in einem Monat, wenn er am Monatsersten gilt. Alle gültigen Bestandteile addieren
// sich, auch gleichen Typs (NK 150 € + NK Kabel 20 €, zwei Stellplätze). Eine Anpassung
// beendet den alten Bestandteil zum Vortag und legt den neuen ab dem Datum an.

export const PREPAYMENT_COMPONENT_TYPES = ["NEBENKOSTEN", "HEIZKOSTEN"];

export type RentComponentLike = {
  type: string;
  amount: unknown;
  effectiveDate: Date | null;
  endDate?: Date | null;
};

const monthStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));

/** Gilt der Bestandteil im Monat von `at`? */
export function componentActive(c: RentComponentLike, at: Date): boolean {
  const m = monthStart(at);
  return (!c.effectiveDate || c.effectiveDate <= m) && (!c.endDate || c.endDate >= m);
}

/** Summe aller im Monat von `at` gültigen Bestandteile (Warmmiete = Kaltmiete + dies). */
export function recurringComponentAmountAt(components: RentComponentLike[], at: Date): number {
  return components.filter((c) => componentActive(c, at)).reduce((sum, c) => sum + Number(c.amount), 0);
}

/** Monatliche NK-/Heizkosten-Vorauszahlung im Monat von `at`. */
export function monthlyPrepaymentAt(components: RentComponentLike[], at: Date): number {
  return recurringComponentAmountAt(components.filter((c) => PREPAYMENT_COMPONENT_TYPES.includes(c.type)), at);
}

/** Vorauszahlungen eines Mietverhältnisses im Jahr, Monat für Monat (gleiche Monate wie monthsActiveInYear). */
export function prepaymentForLeaseYear(
  components: RentComponentLike[],
  leaseStart: Date,
  leaseEnd: Date | null,
  year: number,
): number {
  let total = 0;
  for (let month = 0; month < 12; month++) {
    const first = new Date(Date.UTC(year, month, 1));
    const last = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59));
    if (leaseStart > last || (leaseEnd && leaseEnd < first)) continue;
    total += monthlyPrepaymentAt(components, first);
  }
  return Math.round(total * 100) / 100;
}
