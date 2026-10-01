import { allocate, type AllocationMethod } from "./index";
import { buildStatement } from "./statement";

// WEG-Jahresabrechnung und Hausgeld (#42). Reine Funktion.
// - Kosten werden je Position nach ihrem Verteilerschlüssel umgelegt, bei
//   Zuordnung zu einer Untergemeinschaft nur auf deren Einheiten (eigene
//   MEA-/Flächensumme als Nenner). Heizung/Warmwasser nach HeizkostenV.
// - Hausgeld = Wirtschaftsplan je Kreis (Gesamt-WEG bzw. UG) nach MEA.
// - Je Einheit wird der Betrag nach Eigentümeranteil (‰) auf die Eigentümer geteilt.

export interface WegUnit {
  id: string;
  label: string;
  area: number;
  mea: number;
  consumption?: number;
  subcommunityId: string | null;
}

export interface WegOwner {
  id: string;
  unitId: string;
  share: number; // Anteil an der Einheit in ‰ (1000 = Alleineigentum)
}

export interface WegCost {
  id: string;
  amount: number;
  method: AllocationMethod;
  heating?: boolean;
  consumptionShare?: number;
  subcommunityId: string | null;
}

export interface WegPlan {
  subcommunityId: string | null; // null = Gesamt-WEG
  total: number;
}

export interface WegOwnerLine {
  id: string;
  unitId: string;
  allocated: number; // Anteil an den Ist-Kosten
  hausgeld: number; // Jahres-Hausgeld laut Wirtschaftsplan
  balance: number; // >0 Guthaben, <0 Nachzahlung
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Einheiten eines Kreises: Gesamt-WEG (null) = alle, sonst nur die der UG. */
export function scopeUnits<T extends { subcommunityId: string | null }>(units: T[], subcommunityId: string | null): T[] {
  return subcommunityId ? units.filter((u) => u.subcommunityId === subcommunityId) : units;
}

export function buildWegStatement(units: WegUnit[], owners: WegOwner[], costs: WegCost[], plans: WegPlan[]) {
  // Ist-Kosten je Einheit: Miet-Engine wiederverwenden (ganzjährig, alles umlegen).
  const { lines } = buildStatement(
    units.map((u) => ({ ...u, persons: 1, leases: [{ id: u.id, monthsActive: 12, prepayment: 0 }] })),
    costs.map((c) => ({
      ...c,
      umlagefaehig: true,
      unitIds: c.subcommunityId ? scopeUnits(units, c.subcommunityId).map((u) => u.id) : undefined,
    })),
  );
  const unitCost = new Map(lines.map((l) => [l.unitId, l.allocated]));

  // Hausgeld je Einheit: jeder Plan nach MEA innerhalb seines Kreises.
  const unitHg = new Map(units.map((u) => [u.id, 0]));
  for (const plan of plans) {
    if (plan.total <= 0) continue;
    allocate(plan.total, "MEA", scopeUnits(units, plan.subcommunityId)).forEach((r) =>
      unitHg.set(r.id, (unitHg.get(r.id) ?? 0) + r.amount),
    );
  }

  // Je Einheit auf die Eigentümer nach Anteil (‰) teilen, cent-genau.
  const result: WegOwnerLine[] = [];
  for (const u of units) {
    const os = owners.filter((o) => o.unitId === u.id);
    if (os.length === 0) continue;
    const factor = Math.min(1000, os.reduce((a, o) => a + o.share, 0)) / 1000;
    const parts = os.map((o) => ({ id: o.id, customShare: o.share }));
    const cost = new Map(allocate(round((unitCost.get(u.id) ?? 0) * factor), "CUSTOM", parts).map((r) => [r.id, r.amount]));
    const hg = new Map(allocate(round((unitHg.get(u.id) ?? 0) * factor), "CUSTOM", parts).map((r) => [r.id, r.amount]));
    for (const o of os) {
      const allocated = cost.get(o.id) ?? 0;
      const hausgeld = hg.get(o.id) ?? 0;
      result.push({ id: o.id, unitId: u.id, allocated, hausgeld, balance: round(hausgeld - allocated) });
    }
  }
  return { owners: result, unitCost, unitHausgeld: unitHg };
}
