// WEG-Anteils-Validierung (Miteigentumsanteile, Tausendstel).

export interface MeaCheck {
  sum: number;
  meaTotal: number;
  ok: boolean;
  diff: number; // sum - meaTotal (>0 zu viel, <0 zu wenig)
}

/** Summe der Einheiten-MEA gegen den Sollwert des Objekts prüfen. */
export function checkMeaTotal(unitMeas: (number | null | undefined)[], meaTotal: number): MeaCheck {
  // Auf 4 Nachkommastellen runden, sonst meldet Gleitkomma 0,1+0,2 ≠ 0,3 (#40).
  const r = (n: number) => Math.round(n * 10_000) / 10_000;
  const sum = r(unitMeas.reduce<number>((a, m) => a + (m ?? 0), 0));
  return { sum, meaTotal, ok: sum === r(meaTotal), diff: r(sum - meaTotal) };
}

/** Summe der Eigentümer-Anteile an EINER Einheit (max. 1000 = 100 %). */
export function unitShareSum(shares: number[]): number {
  return Math.round(shares.reduce((a, s) => a + s, 0) * 10_000) / 10_000;
}
