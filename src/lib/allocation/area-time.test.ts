import { describe, it, expect } from "vitest";
import { areaTimeWeights, buildAreaStatement, dayCount, overlapDays, VACANCY_ID } from "./area-time";

const d = (s: string) => new Date(s + "T00:00:00Z");
const YEAR_START = d("2026-01-01");
const YEAR_END = d("2026-12-31");

describe("area-time helpers", () => {
  it("dayCount inklusive", () => {
    expect(dayCount(YEAR_START, YEAR_END)).toBe(365);
    expect(dayCount(d("2026-07-01"), YEAR_END)).toBe(184);
  });
  it("overlapDays", () => {
    expect(overlapDays(d("2026-07-01"), YEAR_END, YEAR_START, YEAR_END)).toBe(184);
    expect(overlapDays(d("2025-01-01"), d("2025-06-01"), YEAR_START, YEAR_END)).toBe(0);
  });
});

describe("areaTimeWeights", () => {
  it("Lagerhalle 1000 m²: A ganzjährig 200, B ab Jul 300, Rest Leerstand", () => {
    const w = areaTimeWeights(
      [
        { id: "A", area: 200, from: YEAR_START, to: YEAR_END },
        { id: "B", area: 300, from: d("2026-07-01"), to: YEAR_END },
      ],
      1000,
      YEAR_START,
      YEAR_END,
    );
    expect(w.weights.get("A")).toBeCloseTo(200, 5);
    expect(w.weights.get("B")).toBeCloseTo(300 * (184 / 365), 2);
    expect(w.occupied).toBeCloseTo(200 + 300 * (184 / 365), 2);
    expect(w.vacancy).toBeCloseTo(1000 - w.occupied, 5);
  });

  it("Außenfläche zählt nicht zur Umlage", () => {
    const w = areaTimeWeights(
      [
        { id: "A", area: 200, from: YEAR_START, to: YEAR_END },
        { id: "P", area: 50, from: YEAR_START, to: YEAR_END, outdoor: true },
      ],
      1000,
      YEAR_START,
      YEAR_END,
    );
    expect(w.weights.has("P")).toBe(false);
    expect(w.occupied).toBeCloseTo(200, 5);
  });
});

describe("buildAreaStatement", () => {
  it("verteilt Kosten m²·Tage-gewichtet inkl. Leerstand, cent-genau", () => {
    const { lines, totalUmlage } = buildAreaStatement(
      [
        { id: "A", area: 200, from: YEAR_START, to: YEAR_END },
        { id: "B", area: 300, from: d("2026-07-01"), to: YEAR_END },
      ],
      1000,
      [{ id: "c1", amount: 10000, umlagefaehig: true }],
      YEAR_START,
      YEAR_END,
    );
    expect(totalUmlage).toBe(10000);
    // Summe geht exakt auf
    const sum = lines.reduce((a, l) => a + l.allocated, 0);
    expect(Math.round(sum * 100) / 100).toBe(10000);
    // A = 200/1000 * 10000 = 2000
    expect(lines.find((l) => l.id === "A")!.allocated).toBeCloseTo(2000, 2);
    // Leerstand trägt den Rest
    const vac = lines.find((l) => l.id === VACANCY_ID)!;
    expect(vac.allocated).toBeGreaterThan(0);
  });

  it("voll vermietet ganzjährig → kein Leerstand", () => {
    const { lines } = buildAreaStatement(
      [{ id: "A", area: 1000, from: YEAR_START, to: YEAR_END }],
      1000,
      [{ id: "c1", amount: 1200, umlagefaehig: true }],
      YEAR_START,
      YEAR_END,
    );
    expect(lines.find((l) => l.id === "A")!.allocated).toBe(1200);
    expect(lines.find((l) => l.id === VACANCY_ID)!.allocated).toBe(0);
  });
});
