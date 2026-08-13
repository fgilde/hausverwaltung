import { describe, it, expect } from "vitest";
import { degreeDayFraction, extrapolateConsumption } from "./heating-degree-days";

const d = (s: string) => new Date(s + "T00:00:00Z");

describe("Gradtagszahl §9b", () => {
  it("volles Jahr = 100 %", () => {
    expect(degreeDayFraction(d("2026-01-01"), d("2026-12-31"))).toBeCloseTo(1, 5);
  });

  it("Winterhalbjahr trägt den Großteil", () => {
    const jan_jun = degreeDayFraction(d("2026-01-01"), d("2026-06-30"));
    // 170+150+130+80+30+0 = 560 ‰
    expect(jan_jun).toBeCloseTo(0.56, 2);
  });

  it("Sommer nahe 0", () => {
    expect(degreeDayFraction(d("2026-06-01"), d("2026-08-31"))).toBeCloseTo(0, 5);
  });

  it("Hochrechnung: Verbrauch Jan–Jun -> Jahreswert", () => {
    const full = extrapolateConsumption(560, d("2026-01-01"), d("2026-06-30"));
    expect(full).toBeCloseTo(1000, 0); // 560 / 0.56
  });

  it("volles Jahr bleibt unverändert", () => {
    expect(extrapolateConsumption(1000, d("2026-01-01"), d("2026-12-31"))).toBeCloseTo(1000, 0);
  });

  it("zu wenig Heizbedarf -> keine Hochrechnung", () => {
    expect(extrapolateConsumption(10, d("2026-07-01"), d("2026-07-31"))).toBe(10);
  });
});
