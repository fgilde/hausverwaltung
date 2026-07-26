import { describe, it, expect } from "vitest";
import { checkMeaTotal, unitShareSum } from "./weg-validation";

describe("checkMeaTotal", () => {
  it("ok wenn Summe = Sollwert", () => {
    const r = checkMeaTotal([340, 360, 300], 1000);
    expect(r).toEqual({ sum: 1000, meaTotal: 1000, ok: true, diff: 0 });
  });

  it("erkennt zu wenig (Leerstand/fehlende MEA)", () => {
    const r = checkMeaTotal([340, 360, null], 1000);
    expect(r.sum).toBe(700);
    expect(r.ok).toBe(false);
    expect(r.diff).toBe(-300);
  });

  it("erkennt zu viel", () => {
    const r = checkMeaTotal([500, 600], 1000);
    expect(r.diff).toBe(100);
    expect(r.ok).toBe(false);
  });
});

describe("unitShareSum", () => {
  it("summiert Eigentümeranteile einer Einheit", () => {
    expect(unitShareSum([500, 500])).toBe(1000);
    expect(unitShareSum([1000])).toBe(1000);
  });
});
