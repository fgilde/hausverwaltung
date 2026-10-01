import { describe, it, expect } from "vitest";
import { buildWegStatement, type WegUnit } from "./weg";

// Beispiel aus #42: UG A (WE1–3, MEA 720), UG B (WE4, MEA 280).
const units: WegUnit[] = [
  { id: "we1", label: "WE1", area: 100, mea: 280, subcommunityId: "A" },
  { id: "we2", label: "WE2", area: 80, mea: 240, subcommunityId: "A" },
  { id: "we3", label: "WE3", area: 60, mea: 200, subcommunityId: "A" },
  { id: "we4", label: "WE4", area: 160, mea: 280, subcommunityId: "B" },
];
const owners = units.map((u) => ({ id: `o-${u.id}`, unitId: u.id, share: 1000 }));
const byOwner = (r: ReturnType<typeof buildWegStatement>) => Object.fromEntries(r.owners.map((o) => [o.unitId, o]));

describe("WEG-Abrechnung mit Untergemeinschaften (#42)", () => {
  it("UG-Kosten nur auf die UG, Nenner = MEA-Summe der UG (720)", () => {
    const r = byOwner(buildWegStatement(units, owners, [{ id: "dach", amount: 7200, method: "MEA", subcommunityId: "A" }], []));
    expect(r.we1.allocated).toBe(2800); // 280/720
    expect(r.we2.allocated).toBe(2400);
    expect(r.we3.allocated).toBe(2000);
    expect(r.we4.allocated).toBe(0);
  });
  it("Gesamt-Kosten nach eigenem Schlüssel (Fläche, Einheiten) über alle", () => {
    const r = byOwner(
      buildWegStatement(units, owners, [
        { id: "strom", amount: 4000, method: "AREA", subcommunityId: null }, // 400 m²
        { id: "verw", amount: 1000, method: "UNITS", subcommunityId: null },
      ], []),
    );
    expect(r.we1.allocated).toBe(1000 + 250);
    expect(r.we4.allocated).toBe(1600 + 250);
  });
  it("Hausgeld je Kreis nach MEA, Saldo = Hausgeld − Kosten", () => {
    const r = byOwner(
      buildWegStatement(
        units,
        owners,
        [{ id: "dach", amount: 720, method: "MEA", subcommunityId: "A" }],
        [{ subcommunityId: null, total: 1000 }, { subcommunityId: "A", total: 1440 }],
      ),
    );
    expect(r.we1.hausgeld).toBe(280 + 560); // 280/1000 + 280/720·1440
    expect(r.we4.hausgeld).toBe(280);
    expect(r.we1.balance).toBe(840 - 280);
  });
  it("Miteigentum an einer Einheit wird nach Anteil (‰) geteilt, cent-genau", () => {
    const shared = [{ id: "x", unitId: "we4", share: 500 }, { id: "y", unitId: "we4", share: 500 }];
    const r = buildWegStatement(units, shared, [{ id: "k", amount: 100.01, method: "MEA", subcommunityId: "B" }], []);
    const amounts = r.owners.map((o) => o.allocated).sort();
    expect(amounts).toEqual([50, 50.01]);
  });
});
