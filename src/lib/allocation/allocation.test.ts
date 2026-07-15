import { describe, it, expect } from "vitest";
import { allocate } from "./index";

const sum = (rs: { amount: number }[]) => Math.round(rs.reduce((a, r) => a + r.amount, 0) * 100) / 100;

describe("allocate", () => {
  it("verteilt nach Fläche und ist cent-genau", () => {
    const res = allocate(1000, "AREA", [
      { id: "a", area: 62.5 },
      { id: "b", area: 74 },
      { id: "c", area: 62.5 },
    ]);
    expect(sum(res)).toBe(1000);
    expect(res[1].amount).toBeGreaterThan(res[0].amount);
  });

  it("verteilt gleich pro Einheit", () => {
    const res = allocate(100, "UNITS", [{ id: "a" }, { id: "b" }, { id: "c" }]);
    expect(sum(res)).toBe(100);
    // 100/3 → 33.34 + 33.33 + 33.33
    expect(res.map((r) => r.amount).sort()).toEqual([33.33, 33.33, 33.34]);
  });

  it("verteilt nach MEA (Tausendstel)", () => {
    const res = allocate(3000, "MEA", [
      { id: "1", mea: 340 },
      { id: "2", mea: 360 },
      { id: "3", mea: 300 },
    ]);
    expect(sum(res)).toBe(3000);
    expect(res[1].amount).toBe(1080);
  });

  it("berücksichtigt Zeitanteil bei Mieterwechsel", () => {
    const res = allocate(1200, "AREA", [
      { id: "alt", area: 100, timeFactor: 0.5 },
      { id: "neu", area: 100, timeFactor: 0.5 },
    ]);
    expect(res[0].amount).toBe(600);
    expect(res[1].amount).toBe(600);
  });

  it("liefert Null bei fehlenden Gewichten", () => {
    const res = allocate(500, "CONSUMPTION", [{ id: "a" }, { id: "b" }]);
    expect(sum(res)).toBe(0);
  });
});
