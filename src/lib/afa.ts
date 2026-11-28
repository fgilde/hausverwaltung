// AfA auf das Gebäude (#103), § 7 Abs. 4 und 5a EStG.
// Linear: Satz % der Bemessungsgrundlage je Jahr. Degressiv (Neubau, § 7 Abs. 5a): Satz % vom
// Restwert zu Jahresbeginn. Im ersten Jahr monatsgenau, der Anschaffungsmonat zählt voll.
// Nie mehr als der Restwert.

export type AfaInput = {
  basis: number;
  start: Date;
  /** % p. a.; leer = Vorschlag (degressiv 5 %, linear nach Baujahr) */
  rate?: number | null;
  degressive?: boolean;
  buildYear?: number | null;
};

/** Vorschlag linear nach Baujahr: vor 1925 2,5 %, 1925–2022 2 %, ab 2023 3 % (unbekannt: 2 %). */
export function suggestedAfaRate(buildYear?: number | null): number {
  if (!buildYear) return 2;
  if (buildYear < 1925) return 2.5;
  if (buildYear >= 2023) return 3;
  return 2;
}

export function afaRateOf(a: AfaInput): number {
  return a.rate ?? (a.degressive ? 5 : suggestedAfaRate(a.buildYear));
}

const cents = (n: number) => Math.round(n * 100) / 100;

/** AfA im Jahr `year` und Restwert danach. */
export function afaForYear(a: AfaInput, year: number): { amount: number; rate: number; restBefore: number; restAfter: number } {
  const rate = afaRateOf(a);
  const startYear = a.start.getUTCFullYear();
  let rest = a.basis;
  for (let y = startYear; y <= year; y++) {
    const months = y === startYear ? 12 - a.start.getUTCMonth() : 12;
    const full = (a.degressive ? rest : a.basis) * (rate / 100);
    const amount = Math.min(rest, cents((full * months) / 12));
    if (y === year) return { amount, rate, restBefore: rest, restAfter: cents(rest - amount) };
    rest = cents(rest - amount);
  }
  return { amount: 0, rate, restBefore: a.basis, restAfter: a.basis };
}
