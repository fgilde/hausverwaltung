import { allocate, type AllocationMethod, type AllocationParticipant } from "./index";

/** HeizkostenV §7/§8: Anteil der Heiz-/Warmwasserkosten, der nach Verbrauch
 *  umgelegt wird (zulässig 50–70 %; hier 70 %). Rest = Grundkosten nach Fläche. */
export const HEATING_CONSUMPTION_SHARE = 0.7;

export interface UnitInput {
  id: string;
  label: string;
  area: number;
  persons: number;
  mea?: number;
  prepayment: number; // NK-Vorauszahlung im Abrechnungszeitraum
  consumption?: number; // gemessener Heiz-/Warmwasserverbrauch (Einheiten)
}

export interface CostInput {
  id: string;
  amount: number;
  method: AllocationMethod;
  umlagefaehig: boolean;
  /** Heiz-/Warmwasserkosten → HeizkostenV-Split 30 % Fläche / 70 % Verbrauch. */
  heating?: boolean;
}

export interface StatementLine {
  unitId: string;
  label: string;
  allocated: number; // umgelegte Kosten
  prepayment: number;
  balance: number; // >0 Guthaben, <0 Nachzahlung
}

function participants(units: UnitInput[]): AllocationParticipant[] {
  return units.map((u) => ({
    id: u.id,
    area: u.area,
    persons: u.persons,
    mea: u.mea,
    consumption: u.consumption ?? 0,
  }));
}

/**
 * Betriebskostenabrechnung: legt jede umlagefähige Kostenposition per
 * Verteilerschlüssel auf die Einheiten um, summiert und verrechnet mit
 * der Vorauszahlung.
 *
 * Heizungs-/Warmwasserpositionen (heating) folgen der HeizkostenV: 30 % der
 * Kosten nach Fläche (Grundkosten), 70 % nach gemessenem Verbrauch. Fehlen alle
 * Verbrauchswerte, fällt die ganze Position auf Fläche zurück (§9a-Näherung).
 *
 * ponytail: Verbrauch = Ablesedifferenz im Jahr; keine Gradtagszahl-/Leerstands-
 * korrektur. Interface trägt bereits `consumption` je Einheit.
 */
export function buildStatement(units: UnitInput[], costs: CostInput[]) {
  const perUnit: Record<string, number> = {};
  units.forEach((u) => (perUnit[u.id] = 0));
  let totalUmlage = 0;

  const totalConsumption = units.reduce((a, u) => a + (u.consumption ?? 0), 0);

  for (const cost of costs) {
    if (!cost.umlagefaehig || cost.amount <= 0) continue;

    if (cost.heating && totalConsumption > 0) {
      // 30 % Grundkosten nach Fläche + 70 % Verbrauchskosten nach Zähler.
      const consAmount = cost.amount * HEATING_CONSUMPTION_SHARE;
      const baseAmount = cost.amount - consAmount;
      allocate(baseAmount, "AREA", participants(units)).forEach((r) => (perUnit[r.id] += r.amount));
      allocate(consAmount, "CONSUMPTION", participants(units)).forEach((r) => (perUnit[r.id] += r.amount));
    } else {
      // Nicht-Heizung, oder Heizung ohne Verbrauchsdaten → nach gewählter Methode
      // (CONSUMPTION ohne Zählerdaten fällt auf Fläche zurück).
      const method: AllocationMethod =
        cost.method === "CONSUMPTION" && totalConsumption <= 0 ? "AREA" : cost.method;
      allocate(cost.amount, method, participants(units)).forEach((r) => (perUnit[r.id] += r.amount));
    }
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
