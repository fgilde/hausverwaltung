import { allocate, type AllocationMethod, type AllocationParticipant } from "./index";

/** HeizkostenV §7/§8: Anteil der Heiz-/Warmwasserkosten, der nach Verbrauch
 *  umgelegt wird (zulässig 50–70 %; hier 70 %). Rest = Grundkosten nach Fläche. */
export const HEATING_CONSUMPTION_SHARE = 0.7;

/**
 * Anzahl Kalendermonate des Jahres `year`, in denen ein Mietverhältnis aktiv ist.
 * Grundlage für die anteilige Vorauszahlung bei unterjährigem Miet-Beginn/-Ende
 * (sonst würde immer mit 12 Monaten gerechnet).
 */
export function monthsActiveInYear(start: Date, end: Date | null, year: number): number {
  let count = 0;
  for (let m = 0; m < 12; m++) {
    const monthStart = new Date(Date.UTC(year, m, 1));
    const monthEnd = new Date(Date.UTC(year, m + 1, 0, 23, 59, 59));
    if (start <= monthEnd && (!end || end >= monthStart)) count++;
  }
  return count;
}

/** Ein Mietverhältnis (Zeitscheibe) einer Einheit im Abrechnungsjahr. */
export interface LeaseSlice {
  id: string;
  /** Aktive Mietmonate im Abrechnungsjahr (0..12). */
  monthsActive: number;
  /** NK-Vorauszahlung im Zeitraum (monatlich × aktive Monate). */
  prepayment: number;
}

export interface UnitInput {
  id: string;
  label: string;
  area: number;
  persons: number;
  mea?: number;
  consumption?: number; // gemessener Heiz-/Warmwasserverbrauch (Einheiten)
  /** Mietverhältnisse der Einheit im Abrechnungsjahr (0..n). Bei Mieterwechsel
   *  mehrere; leer = Leerstand. Zeitanteilige Kosten werden pro Lease nach
   *  aktiven Monaten gekürzt (Leerstand trägt der Vermieter); Verbrauchskosten
   *  werden auf die Leases der Einheit nach Monatsanteil verteilt (der Zähler
   *  deckt nur die Gesamt-Nutzungszeit ab). */
  leases: LeaseSlice[];
}

export interface CostInput {
  id: string;
  amount: number;
  method: AllocationMethod;
  umlagefaehig: boolean;
  /** Heiz-/Warmwasserkosten → HeizkostenV-Split (Grundkosten Fläche / Verbrauch). */
  heating?: boolean;
  /** Verbrauchsanteil 0..1 (nur heating). Fehlt → HEATING_CONSUMPTION_SHARE (0,7).
   *  1 = 100 % nach Verbrauch (bei exaktem Verbrauch). */
  consumptionShare?: number;
}

export interface StatementLine {
  unitId: string;
  leaseId: string | null; // null = Einheit ohne Mietverhältnis (Leerstand)
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
  // Zwei Töpfe je Einheit: zeitanteilig kürzbare Kosten (Fläche/Einheit/Person/
  // MEA) und Verbrauchskosten (Zähler). Nur der Zeit-Topf wird bei unterjährigem
  // Mietverhältnis gekürzt; der Verbrauch deckt bereits nur die Nutzungszeit ab.
  const perUnitTime: Record<string, number> = {};
  const perUnitCons: Record<string, number> = {};
  units.forEach((u) => {
    perUnitTime[u.id] = 0;
    perUnitCons[u.id] = 0;
  });
  let totalUmlage = 0;

  const totalConsumption = units.reduce((a, u) => a + (u.consumption ?? 0), 0);

  for (const cost of costs) {
    if (!cost.umlagefaehig || cost.amount <= 0) continue;

    if (cost.heating && totalConsumption > 0) {
      // Grundkosten nach Fläche + Verbrauchskosten nach Zähler.
      // Anteil je Position einstellbar (Default 70 %, 100 % = rein nach Verbrauch).
      const share = Math.min(1, Math.max(0, cost.consumptionShare ?? HEATING_CONSUMPTION_SHARE));
      const consAmount = cost.amount * share;
      const baseAmount = cost.amount - consAmount;
      allocate(baseAmount, "AREA", participants(units)).forEach((r) => (perUnitTime[r.id] += r.amount));
      allocate(consAmount, "CONSUMPTION", participants(units)).forEach((r) => (perUnitCons[r.id] += r.amount));
    } else {
      // Nicht-Heizung, oder Heizung ohne Verbrauchsdaten → nach gewählter Methode
      // (CONSUMPTION ohne Zählerdaten fällt auf Fläche zurück).
      const method: AllocationMethod =
        cost.method === "CONSUMPTION" && totalConsumption <= 0 ? "AREA" : cost.method;
      const bucket = method === "CONSUMPTION" ? perUnitCons : perUnitTime;
      allocate(cost.amount, method, participants(units)).forEach((r) => (bucket[r.id] += r.amount));
    }
    totalUmlage += cost.amount;
  }

  const round = (n: number) => Math.round(n * 100) / 100;
  const clampMonths = (m: number) => Math.min(12, Math.max(0, m));

  // Eine Zeile je Mietverhältnis. Zeitkosten der Einheit werden nach aktiven
  // Monaten/12 auf die Leases verteilt (Rest = Leerstand → Vermieter, keine
  // Zeile). Verbrauchskosten werden auf die Leases der Einheit nach ihrem
  // Monatsanteil aufgeteilt (eine Lease → voll; kein taggenauer Zwischenstand).
  const lines: StatementLine[] = [];
  for (const u of units) {
    const timeTotal = perUnitTime[u.id];
    const consTotal = perUnitCons[u.id];

    if (u.leases.length === 0) {
      lines.push({ unitId: u.id, leaseId: null, label: u.label, allocated: 0, prepayment: 0, balance: 0 });
      continue;
    }

    const sumMonths = u.leases.reduce((a, l) => a + clampMonths(l.monthsActive), 0);
    for (const lease of u.leases) {
      const m = clampMonths(lease.monthsActive);
      const timePart = timeTotal * (m / 12);
      const consPart = sumMonths > 0 ? consTotal * (m / sumMonths) : 0;
      const allocated = round(timePart + consPart);
      lines.push({
        unitId: u.id,
        leaseId: lease.id,
        label: u.label,
        allocated,
        prepayment: round(lease.prepayment),
        balance: round(lease.prepayment - allocated),
      });
    }
  }

  return { lines, totalUmlage: round(totalUmlage) };
}
