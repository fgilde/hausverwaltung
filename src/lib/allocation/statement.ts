import { allocate, type AllocationMethod, type AllocationParticipant } from "./index";

export interface UnitInput {
  id: string;
  label: string;
  area: number;
  persons: number;
  mea?: number;
  prepayment: number; // NK-Vorauszahlung im Abrechnungszeitraum
}

export interface CostInput {
  id: string;
  amount: number;
  method: AllocationMethod;
  umlagefaehig: boolean;
}

export interface StatementLine {
  unitId: string;
  label: string;
  allocated: number; // umgelegte Kosten
  prepayment: number;
  balance: number; // >0 Guthaben, <0 Nachzahlung
}

/**
 * Betriebskostenabrechnung: legt jede umlagefähige Kostenposition per
 * Verteilerschlüssel auf die Einheiten um, summiert und verrechnet mit
 * der Vorauszahlung.
 *
 * ponytail: CONSUMPTION fällt mangels Zählerdaten auf Fläche zurück —
 * echte HeizkostenV-Verbrauchsumlage (50–70%) folgt mit Zähler-Integration.
 */
export function buildStatement(units: UnitInput[], costs: CostInput[]) {
  const perUnit: Record<string, number> = {};
  units.forEach((u) => (perUnit[u.id] = 0));
  let totalUmlage = 0;

  for (const cost of costs) {
    if (!cost.umlagefaehig || cost.amount <= 0) continue;
    const parts: AllocationParticipant[] = units.map((u) => ({
      id: u.id,
      area: u.area,
      persons: u.persons,
      mea: u.mea,
      consumption: u.area, // Fallback
    }));
    const res = allocate(cost.amount, cost.method, parts);
    res.forEach((r) => (perUnit[r.id] += r.amount));
    totalUmlage += cost.amount;
  }

  const round = (n: number) => Math.round(n * 100) / 100;
  const lines: StatementLine[] = units.map((u) => {
    const allocated = round(perUnit[u.id]);
    return {
      unitId: u.id,
      label: u.label,
      allocated,
      prepayment: round(u.prepayment),
      balance: round(u.prepayment - allocated),
    };
  });

  return { lines, totalUmlage: round(totalUmlage) };
}
