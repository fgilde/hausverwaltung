// Flächenmodell (Gewerbe): m²·Tage-Gewichtung über einen Abrechnungszeitraum.
// Reine Funktionen, voll testbar. Grundidee: belegte Fläche·Zeit + Leerstand·Zeit
// = Gesamtfläche·Zeit → die Umlage geht IMMER auf, auch bei unterjährigen Änderungen.

export interface AreaSlice {
  id: string; // Teilnehmer (z. B. leaseId)
  area: number; // m²
  from: Date;
  to?: Date | null; // null/offen = bis Periodenende
  outdoor?: boolean; // Außenfläche → zählt nicht zur Pool-Summe/NK
}

const DAY = 86_400_000;

/** Anzahl Kalendertage in [start, end] inklusive. */
export function dayCount(start: Date, end: Date): number {
  const d = Math.floor((end.getTime() - start.getTime()) / DAY) + 1;
  return d > 0 ? d : 0;
}

/** Überlappende Tage zwischen [aFrom,aTo] und [bFrom,bTo], inklusive. */
export function overlapDays(aFrom: Date, aTo: Date, bFrom: Date, bTo: Date): number {
  const lo = Math.max(aFrom.getTime(), bFrom.getTime());
  const hi = Math.min(aTo.getTime(), bTo.getTime());
  if (hi < lo) return 0;
  return Math.floor((hi - lo) / DAY) + 1;
}

export interface AreaWeights {
  weights: Map<string, number>; // je Teilnehmer: area·(Tage/Periodentage)
  occupied: number; // Σ belegte Gewichte
  vacancy: number; // Leerstands-Gewicht = totalArea − occupied (≥0)
  total: number; // totalArea
}

/**
 * m²·Tage-Gewichte je Teilnehmer über [periodStart, periodEnd]. Außenflächen
 * werden ignoriert (gehen nicht in die NK-Umlage). Leerstand = Rest zur
 * Gesamtfläche, sodass Σ = totalArea.
 */
export function areaTimeWeights(
  slices: AreaSlice[],
  totalArea: number,
  periodStart: Date,
  periodEnd: Date,
): AreaWeights {
  const totalDays = Math.max(1, dayCount(periodStart, periodEnd));
  const weights = new Map<string, number>();
  for (const s of slices) {
    if (s.outdoor) continue;
    const ov = overlapDays(s.from, s.to ?? periodEnd, periodStart, periodEnd);
    if (ov <= 0 || s.area <= 0) continue;
    const w = s.area * (ov / totalDays);
    weights.set(s.id, (weights.get(s.id) ?? 0) + w);
  }
  const occupied = [...weights.values()].reduce((a, b) => a + b, 0);
  const vacancy = Math.max(0, totalArea - occupied);
  return { weights, occupied, vacancy, total: totalArea };
}

export interface AreaCost {
  id: string;
  amount: number;
  umlagefaehig: boolean;
}

export interface AreaStatementLine {
  id: string; // leaseId oder "__vacancy__"
  weight: number; // m²·Zeitanteil
  allocated: number; // € umgelegt
}

export const VACANCY_ID = "__vacancy__";

/**
 * Legt umlagefähige Kosten nach m²·Tage-Gewicht auf Teilnehmer + Leerstand um.
 * Cent-genau (Restcent an größte Nachkommaanteile). Summe der allocated ==
 * Summe der umlagefähigen Kosten.
 */
export function buildAreaStatement(
  slices: AreaSlice[],
  totalArea: number,
  costs: AreaCost[],
  periodStart: Date,
  periodEnd: Date,
): { lines: AreaStatementLine[]; totalUmlage: number } {
  const w = areaTimeWeights(slices, totalArea, periodStart, periodEnd);
  const ids = [...w.weights.keys(), VACANCY_ID];
  const weightOf = (id: string) => (id === VACANCY_ID ? w.vacancy : (w.weights.get(id) ?? 0));

  const totalUmlage = costs.filter((c) => c.umlagefaehig && c.amount > 0).reduce((a, c) => a + c.amount, 0);
  const totalCents = Math.round(totalUmlage * 100);
  const denom = w.total > 0 ? w.total : 1;

  const raw = ids.map((id) => (totalCents * weightOf(id)) / denom);
  const floors = raw.map((r) => Math.floor(r));
  let remainder = totalCents - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac);
  const cents = floors.slice();
  for (const { i } of order) {
    if (remainder <= 0) break;
    cents[i] += 1;
    remainder -= 1;
  }

  const lines = ids.map((id, i) => ({
    id,
    weight: Math.round(weightOf(id) * 100) / 100,
    allocated: cents[i] / 100,
  }));
  return { lines, totalUmlage: Math.round(totalUmlage * 100) / 100 };
}
