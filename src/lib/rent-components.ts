// Mietbestandteile mit Gültigkeit (#87): gilt ab effectiveDate bis endDate, beides optional
// (leer = seit Vertragsbeginn bzw. unbefristet). Gerechnet wird monatsweise: ein Bestandteil
// zählt in einem Monat, wenn er am Monatsersten gilt. Alle gültigen Bestandteile addieren
// sich, auch gleichen Typs (NK 150 € + NK Kabel 20 €, zwei Stellplätze). Eine Anpassung
// beendet den alten Bestandteil zum Vortag und legt den neuen ab dem Datum an.

export const PREPAYMENT_COMPONENT_TYPES = ["NEBENKOSTEN", "HEIZKOSTEN"];
/** Betriebskostenpauschale (#110): Teil der Nebenkosten-Sollstellung, aber keine Vorauszahlung. */
export const FLAT_RATE_TYPE = "PAUSCHALE";
/** Beschreibung der getrennten NK-Sollstellung (#109); daran erkennt der Lauf sie wieder. */
export const NK_PREPAYMENT_DESC = "Nebenkosten-Vorauszahlung";

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

const DAY = 86_400_000;
const dayOf = (d: Date | number) => Math.floor((typeof d === "number" ? d : d.getTime()) / DAY);

/** Anteil des Monats, in dem der Vertrag läuft: Tage / Tage im Monat, 0..1 (#108). */
export function monthShare(leaseStart: Date, leaseEnd: Date | null, year: number, month: number): number {
  const m0 = dayOf(Date.UTC(year, month, 1));
  const m1 = dayOf(Date.UTC(year, month + 1, 1));
  const from = Math.max(m0, dayOf(leaseStart));
  const to = Math.min(m1, leaseEnd ? dayOf(leaseEnd) + 1 : m1);
  return Math.max(0, to - from) / (m1 - m0);
}

/** Bestandteile, die mit dem Vertrag beginnen, gelten schon im (angebrochenen) Einzugsmonat. */
function fromLeaseStart(components: RentComponentLike[], leaseStart: Date): RentComponentLike[] {
  return components.map((c) => (c.effectiveDate && c.effectiveDate <= leaseStart ? { ...c, effectiveDate: null } : c));
}

/** Vorauszahlungen eines Mietverhältnisses im Jahr, Monat für Monat; angebrochene Monate anteilig nach Tagen (#108). */
export function prepaymentForLeaseYear(
  components: RentComponentLike[],
  leaseStart: Date,
  leaseEnd: Date | null,
  year: number,
): number {
  const comps = fromLeaseStart(components, leaseStart);
  let total = 0;
  for (let month = 0; month < 12; month++) {
    const share = monthShare(leaseStart, leaseEnd, year, month);
    if (share > 0) total += monthlyPrepaymentAt(comps, new Date(Date.UTC(year, month, 1))) * share;
  }
  return Math.round(total * 100) / 100;
}

export type MonthCharge = { type: "MIETE" | "NEBENKOSTEN"; amount: number; description?: string };

/**
 * Sollstellungen eines Vertrags für einen Monat: bei Ein-/Auszug im Monat anteilig nach Tagen (#108),
 * auf Wunsch Kaltmiete und Nebenkosten (Vorauszahlungen + Pauschale) getrennt (#109).
 */
export function monthCharges(
  lease: { rentCold: unknown; startDate: Date; endDate: Date | null; components: RentComponentLike[] },
  year: number,
  month: number,
  split: boolean,
): MonthCharge[] {
  const share = monthShare(lease.startDate, lease.endDate, year, month);
  if (share <= 0) return [];
  const at = new Date(Date.UTC(year, month, 1));
  const comps = fromLeaseStart(lease.components, lease.startDate);
  const warm = Number(lease.rentCold) + recurringComponentAmountAt(comps, at);
  const nk = recurringComponentAmountAt(comps.filter((c) => PREPAYMENT_COMPONENT_TYPES.includes(c.type) || c.type === FLAT_RATE_TYPE), at);
  const cents = (n: number) => Math.round(n * share * 100) / 100;
  const monthDays = dayOf(Date.UTC(year, month + 1, 1)) - dayOf(at);
  const part = share < 1 ? ` (anteilig ${Math.round(share * monthDays)}/${monthDays} Tage)` : "";
  if (!split) return [{ type: "MIETE", amount: cents(warm), ...(part ? { description: `Miete${part}` } : {}) }];
  return [
    { type: "MIETE" as const, amount: cents(warm - nk), ...(part ? { description: `Kaltmiete${part}` } : {}) },
    { type: "NEBENKOSTEN" as const, amount: cents(nk), description: `${NK_PREPAYMENT_DESC}${part}` },
  ].filter((c) => c.amount > 0);
}
