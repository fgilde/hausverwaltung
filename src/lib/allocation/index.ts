// Verteilerschlüssel-Engine — geteilter Kern von Miet-NK-Abrechnung und
// WEG-Jahresabrechnung. Reine Funktion, cent-genau (Largest-Remainder).

export type AllocationMethod =
  | "AREA" // Wohn-/Nutzfläche
  | "UNITS" // pro Einheit gleich
  | "MEA" // Miteigentumsanteile (WEG)
  | "PERSONS" // Personenzahl
  | "CONSUMPTION" // Verbrauch (Zähler)
  | "CUSTOM"; // frei gesetzter Anteil

export interface AllocationParticipant {
  id: string;
  area?: number;
  persons?: number;
  mea?: number;
  consumption?: number;
  customShare?: number;
  /** Zeitanteil am Abrechnungszeitraum (0..1), z. B. bei Mieterwechsel. Default 1. */
  timeFactor?: number;
}

export interface AllocationResult {
  id: string;
  /** Gewichtsanteil 0..1 */
  share: number;
  /** Zugeteilter Betrag in Euro, auf Cent gerundet. Summe == total. */
  amount: number;
}

function baseWeight(p: AllocationParticipant, method: AllocationMethod): number {
  switch (method) {
    case "AREA":
      return p.area ?? 0;
    case "UNITS":
      return 1;
    case "MEA":
      return p.mea ?? 0;
    case "PERSONS":
      return p.persons ?? 0;
    case "CONSUMPTION":
      return p.consumption ?? 0;
    case "CUSTOM":
      return p.customShare ?? 0;
  }
}

/**
 * Verteilt `total` (Euro) auf die Teilnehmer nach `method`.
 * Zeitanteilig über timeFactor. Cent-genau: Summe der amounts == total.
 */
export function allocate(
  total: number,
  method: AllocationMethod,
  participants: AllocationParticipant[],
): AllocationResult[] {
  const weights = participants.map((p) => baseWeight(p, method) * (p.timeFactor ?? 1));
  const sumW = weights.reduce((a, b) => a + b, 0);

  if (sumW <= 0) {
    return participants.map((p) => ({ id: p.id, share: 0, amount: 0 }));
  }

  const totalCents = Math.round(total * 100);
  const raw = weights.map((w) => (totalCents * w) / sumW);
  const floors = raw.map((r) => Math.floor(r));
  let remainder = totalCents - floors.reduce((a, b) => a + b, 0);

  // Restcent an die größten Nachkommaanteile (Largest-Remainder).
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);

  const cents = floors.slice();
  for (const { i } of order) {
    if (remainder <= 0) break;
    cents[i] += 1;
    remainder -= 1;
  }

  return participants.map((p, i) => ({
    id: p.id,
    share: weights[i] / sumW,
    amount: cents[i] / 100,
  }));
}
