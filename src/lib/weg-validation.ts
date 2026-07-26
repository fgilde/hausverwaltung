// WEG-Anteils-Validierung (Miteigentumsanteile, Tausendstel).

export interface MeaCheck {
  sum: number;
  meaTotal: number;
  ok: boolean;
  diff: number; // sum - meaTotal (>0 zu viel, <0 zu wenig)
}

/** Summe der Einheiten-MEA gegen den Sollwert des Objekts prüfen. */
export function checkMeaTotal(unitMeas: (number | null | undefined)[], meaTotal: number): MeaCheck {
  const sum = unitMeas.reduce<number>((a, m) => a + (m ?? 0), 0);
  return { sum, meaTotal, ok: sum === meaTotal, diff: sum - meaTotal };
}

/** Summe der Eigentümer-Anteile an EINER Einheit (max. 1000 = 100 %). */
export function unitShareSum(shares: number[]): number {
  return shares.reduce((a, s) => a + s, 0);
}
