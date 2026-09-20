import { monthsActiveInYear } from "@/lib/allocation/statement";

export interface InsurancePolicy {
  premium: number; // Jahresprämie
  startDate: Date | null;
  endDate: Date | null;
}

/**
 * Summe der auf ein Kalenderjahr entfallenden Versicherungsprämien eines Objekts.
 * Versicherungen laufen oft unterjährig (12 Monate ab Beginn); je Police wird die
 * Jahresprämie zeitanteilig auf das Kalenderjahr umgelegt:
 *   Prämie × (im Jahr überlappende Monate / 12).
 * Ohne Datumsangabe gilt eine Police als ganzjährig (volle Prämie).
 *
 * Beispiel: Police A 01.07.2025–30.06.2026 (1200 €) + Police B 01.07.2026–30.06.2027
 * (1500 €) ergeben für 2026: 1200·6/12 + 1500·6/12 = 1350 €.
 */
export function insuranceYearAmount(policies: InsurancePolicy[], year: number): number {
  let sum = 0;
  for (const p of policies) {
    if (p.premium <= 0) continue;
    const start = p.startDate ?? new Date(Date.UTC(1970, 0, 1));
    const months = monthsActiveInYear(start, p.endDate ?? null, year);
    sum += (p.premium * months) / 12;
  }
  return Math.round(sum * 100) / 100;
}
