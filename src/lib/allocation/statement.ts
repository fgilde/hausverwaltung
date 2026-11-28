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

/** Zeitscheibe mit Personenzahl (#90): ein Mietverhältnis bzw. Leerstand (leaseId null)
 *  mit `persons` Personen für `fraction` des Abrechnungsjahres (Tage / Tage im Jahr). */
export interface PersonSlice {
  leaseId: string | null;
  persons: number;
  fraction: number;
}

export interface UnitInput {
  id: string;
  label: string;
  area: number;
  /** Personenzahl fürs ganze Jahr; ersetzt durch personSlices, wenn vorhanden. */
  persons: number;
  /** Personenzahl je Zeitraum (#90). Gesetzt → Umlage nach Personen tagesgenau nach
   *  Personen × Zeitanteil; jedes Mietverhältnis trägt genau seine Personen-Tage. */
  personSlices?: PersonSlice[];
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
  /** Nur diese Einheiten tragen die Position (Untergemeinschaft #42, Einheitstypen #105). Fehlt → alle. */
  unitIds?: string[];
}

/** Ein Rechenschritt der Einzelabrechnung (#94): eine Kostenposition (bei Heizkosten
 *  Grund- und Verbrauchsanteil getrennt) und der Anteil dieses Mietverhältnisses daran. */
export interface StatementItem {
  costId: string;
  /** ganze Position, HeizkostenV-Grundkosten (Fläche) oder Verbrauchskosten */
  part: "full" | "base" | "consumption";
  /** tatsächlich angewandter Schlüssel (CONSUMPTION ohne Zählerdaten → AREA) */
  method: AllocationMethod;
  /** umzulegender Betrag dieses Teils über den ganzen Verteilerkreis */
  total: number;
  /** Summe der Schlüsselwerte im Verteilerkreis (m², Einheiten, Personen-Jahre, Verbrauch, MEA) */
  totalBasis: number;
  /** Schlüsselwert der Einheit; bei Personen mit Zeitscheiben die Personen-Jahre dieses Mietverhältnisses */
  unitBasis: number;
  /** Anteil dieses Mietverhältnisses am Betrag der Einheit (Monats-/Verbrauchsanteil), 0..1 */
  leaseFactor: number;
  /** wie der Betrag der Einheit aufs Mietverhältnis kommt: nach Monaten, nach Monatsanteil am
   *  Verbrauch, oder schon in den Personen-Tagen enthalten (#90) */
  apportion: "months" | "consumption" | "persons";
  /** Betrag für dieses Mietverhältnis, auf Cent; Summe der Items == allocated */
  amount: number;
}

export interface StatementLine {
  unitId: string;
  leaseId: string | null; // null = Einheit ohne Mietverhältnis (Leerstand)
  label: string;
  allocated: number; // umgelegte Kosten
  prepayment: number;
  balance: number; // >0 Guthaben, <0 Nachzahlung
  items: StatementItem[];
}

function weightOf(u: UnitInput, method: AllocationMethod): number {
  switch (method) {
    case "AREA":
      return u.area;
    case "UNITS":
      return 1;
    case "MEA":
      return u.mea ?? 0;
    case "PERSONS":
      return u.personSlices ? u.personSlices.reduce((a, s) => a + s.persons * s.fraction, 0) : u.persons;
    case "CONSUMPTION":
      return u.consumption ?? 0;
    default:
      return 0;
  }
}

function participants(units: UnitInput[]): AllocationParticipant[] {
  return units.map((u) => ({
    id: u.id,
    area: u.area,
    persons: weightOf(u, "PERSONS"),
    mea: u.mea,
    consumption: u.consumption ?? 0,
  }));
}

/** Rundet Beträge so auf Cent, dass ihre Summe genau `targetCents` ergibt (Largest-Remainder). */
export function roundToSum(values: number[], targetCents: number): number[] {
  const raw = values.map((v) => v * 100);
  const cents = raw.map((r) => Math.floor(r));
  let rest = targetCents - cents.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac);
  for (let k = 0; rest !== 0 && order.length > 0; k = (k + 1) % order.length) {
    const step = rest > 0 ? 1 : -1;
    cents[order[k].i] += step;
    rest -= step;
  }
  return cents.map((c) => c / 100);
}

/** Betrag einer Einheit für einen Teil einer Kostenposition, vor der Aufteilung auf Mietverhältnisse. */
interface UnitPart {
  costId: string;
  part: StatementItem["part"];
  method: AllocationMethod;
  total: number;
  totalBasis: number;
  unitBasis: number;
  amount: number;
  /** time = nach aktiven Monaten gekürzt, cons = Verbrauch auf die Leases verteilt,
   *  persons = nach Personen-Tagen der Leases (#90) */
  pot: "time" | "cons" | "persons";
}

/**
 * Betriebskostenabrechnung: legt jede umlagefähige Kostenposition per
 * Verteilerschlüssel auf die Einheiten um, summiert und verrechnet mit
 * der Vorauszahlung. Jede Zeile trägt die Rechenschritte je Position (#94).
 *
 * Heizungs-/Warmwasserpositionen (heating) folgen der HeizkostenV: 30 % der
 * Kosten nach Fläche (Grundkosten), 70 % nach gemessenem Verbrauch. Fehlen alle
 * Verbrauchswerte, fällt die ganze Position auf Fläche zurück (§9a-Näherung).
 *
 * ponytail: Verbrauch = Ablesedifferenz im Jahr; keine Gradtagszahl-/Leerstands-
 * korrektur. Interface trägt bereits `consumption` je Einheit.
 */
export function buildStatement(units: UnitInput[], costs: CostInput[]) {
  // Je Einheit die Teile aller Positionen. Zeit-Teile (Fläche/Einheit/MEA, Personen ohne
  // Zeitscheiben) werden bei unterjährigem Mietverhältnis gekürzt, Verbrauch deckt schon nur
  // die Nutzungszeit ab, Personen mit Zeitscheiben tragen ihren Zeitanteil bereits im Gewicht.
  const unitParts: Record<string, UnitPart[]> = {};
  units.forEach((u) => (unitParts[u.id] = []));
  let totalUmlage = 0;

  const spread = (cost: CostInput, part: UnitPart["part"], method: AllocationMethod, amount: number, scope: UnitInput[]) => {
    const totalBasis = scope.reduce((a, u) => a + weightOf(u, method), 0);
    const pot: UnitPart["pot"] =
      method === "CONSUMPTION" ? "cons" : method === "PERSONS" && scope.some((u) => u.personSlices) ? "persons" : "time";
    const byId = new Map(scope.map((u) => [u.id, u]));
    allocate(amount, method, participants(scope)).forEach((r) => {
      const unitBasis = weightOf(byId.get(r.id)!, method);
      unitParts[r.id].push({ costId: cost.id, part, method, total: amount, totalBasis, unitBasis, amount: r.amount, pot });
    });
  };

  for (const cost of costs) {
    if (!cost.umlagefaehig || cost.amount <= 0) continue;
    // Verteilerkreis: alle Einheiten oder nur die der Untergemeinschaft / Einheitstypen.
    const scope = cost.unitIds ? units.filter((u) => cost.unitIds!.includes(u.id)) : units;
    if (scope.length === 0) continue;
    const totalConsumption = scope.reduce((a, u) => a + (u.consumption ?? 0), 0);

    if (cost.heating && totalConsumption > 0) {
      // Grundkosten nach Fläche + Verbrauchskosten nach Zähler.
      // Anteil je Position einstellbar (Default 70 %, 100 % = rein nach Verbrauch).
      const share = Math.min(1, Math.max(0, cost.consumptionShare ?? HEATING_CONSUMPTION_SHARE));
      const consAmount = cost.amount * share;
      spread(cost, "base", "AREA", cost.amount - consAmount, scope);
      spread(cost, "consumption", "CONSUMPTION", consAmount, scope);
    } else {
      // Nicht-Heizung, oder Heizung ohne Verbrauchsdaten → nach gewählter Methode
      // (CONSUMPTION ohne Zählerdaten fällt auf Fläche zurück).
      const method: AllocationMethod =
        cost.method === "CONSUMPTION" && totalConsumption <= 0 ? "AREA" : cost.method;
      spread(cost, "full", method, cost.amount, scope);
    }
    totalUmlage += cost.amount;
  }

  const round = (n: number) => Math.round(n * 100) / 100;
  const clampMonths = (m: number) => Math.min(12, Math.max(0, m));

  // Eine Zeile je Mietverhältnis. Zeitkosten der Einheit werden nach aktiven
  // Monaten/12 auf die Leases verteilt (Rest = Leerstand → Vermieter, keine
  // Zeile). Verbrauchskosten werden auf die Leases der Einheit nach ihrem
  // Monatsanteil aufgeteilt (eine Lease → voll; kein taggenauer Zwischenstand).
  // Personen mit Zeitscheiben: jede Lease trägt ihre Personen-Tage, Leerstand der Vermieter.
  const lines: StatementLine[] = [];
  for (const u of units) {
    if (u.leases.length === 0) {
      lines.push({ unitId: u.id, leaseId: null, label: u.label, allocated: 0, prepayment: 0, balance: 0, items: [] });
      continue;
    }

    const sumMonths = u.leases.reduce((a, l) => a + clampMonths(l.monthsActive), 0);
    const personWeight = weightOf(u, "PERSONS");
    for (const lease of u.leases) {
      const m = clampMonths(lease.monthsActive);
      const leasePersons = (u.personSlices ?? [])
        .filter((s) => s.leaseId === lease.id)
        .reduce((a, s) => a + s.persons * s.fraction, 0);
      const raw = unitParts[u.id].map((p) => {
        const factor =
          p.pot === "time"
            ? m / 12
            : p.pot === "cons"
              ? sumMonths > 0 ? m / sumMonths : 0
              : personWeight > 0 ? leasePersons / personWeight : 0;
        return { p, factor, amount: p.amount * factor };
      });
      const allocated = round(raw.reduce((a, r) => a + r.amount, 0));
      const cents = roundToSum(raw.map((r) => r.amount), Math.round(allocated * 100));
      lines.push({
        unitId: u.id,
        leaseId: lease.id,
        label: u.label,
        allocated,
        prepayment: round(lease.prepayment),
        balance: round(lease.prepayment - allocated),
        items: raw.map(({ p, factor }, i) => ({
          costId: p.costId,
          part: p.part,
          method: p.method,
          total: round(p.total),
          totalBasis: p.totalBasis,
          unitBasis: p.pot === "persons" ? leasePersons : p.unitBasis,
          leaseFactor: p.pot === "persons" ? 1 : factor,
          apportion: p.pot === "time" ? "months" : p.pot === "cons" ? "consumption" : "persons",
          amount: cents[i],
        })),
      });
    }
  }

  return { lines, totalUmlage: round(totalUmlage) };
}

const DAY = 86_400_000;
const dayOf = (d: Date) => Math.floor(d.getTime() / DAY);

/**
 * Personen-Zeitscheiben einer Einheit im Jahr (#90), tagesgenau: je Mietverhältnis die
 * Personenzahl ab Vertragsbeginn bzw. ab jeder Änderung, dazu der Leerstand. Leerstand
 * zählt mit der Personenzahl des letzten Mietverhältnisses (1 ohne Vertrag), wie bisher,
 * und wird vom Vermieter getragen.
 */
export function personSlices(
  leases: { id: string; startDate: Date; endDate: Date | null; personCount: number; occupancies?: { validFrom: Date; persons: number }[] }[],
  year: number,
): PersonSlice[] {
  const y0 = dayOf(new Date(Date.UTC(year, 0, 1)));
  const y1 = dayOf(new Date(Date.UTC(year + 1, 0, 1))); // exklusiv
  const yearDays = y1 - y0;
  const slices: PersonSlice[] = [];
  let leased = 0;
  for (const l of leases) {
    const from = Math.max(y0, dayOf(l.startDate));
    const to = Math.min(y1, l.endDate ? dayOf(l.endDate) + 1 : y1);
    if (to <= from) continue;
    // Abschnitte zwischen Vertragsbeginn und den Änderungen
    const changes = [...(l.occupancies ?? [])].sort((a, b) => a.validFrom.getTime() - b.validFrom.getTime());
    let persons = l.personCount;
    let cursor = from;
    for (const c of changes) {
      const at = dayOf(c.validFrom);
      if (at <= cursor) {
        persons = c.persons;
        continue;
      }
      if (at >= to) break;
      slices.push({ leaseId: l.id, persons, fraction: (at - cursor) / yearDays });
      cursor = at;
      persons = c.persons;
    }
    slices.push({ leaseId: l.id, persons, fraction: (to - cursor) / yearDays });
    leased += to - from;
  }
  const vacant = yearDays - Math.min(yearDays, leased);
  if (vacant > 0) slices.push({ leaseId: null, persons: leases.at(-1)?.personCount ?? 1, fraction: vacant / yearDays });
  return slices;
}
