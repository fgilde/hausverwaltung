import { describe, it, expect } from "vitest";
import { afaForYear, suggestedAfaRate } from "./afa";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe("AfA (#103)", () => {
  it("Satz nach Baujahr", () => {
    expect(suggestedAfaRate(1900)).toBe(2.5);
    expect(suggestedAfaRate(1990)).toBe(2);
    expect(suggestedAfaRate(2024)).toBe(3);
    expect(suggestedAfaRate(null)).toBe(2);
  });

  it("linear 2 %, Kauf im April: erstes Jahr 9/12, danach voll", () => {
    const a = { basis: 300_000, start: d("2024-04-15"), buildYear: 1990 };
    expect(afaForYear(a, 2023).amount).toBe(0);
    expect(afaForYear(a, 2024).amount).toBe(4500); // 6000 × 9/12
    expect(afaForYear(a, 2025)).toMatchObject({ amount: 6000, restBefore: 295_500, restAfter: 289_500 });
  });

  it("linear endet beim Restwert", () => {
    const a = { basis: 1000, start: d("2000-01-01"), rate: 30 };
    expect(afaForYear(a, 2002).amount).toBe(300);
    expect(afaForYear(a, 2003).amount).toBe(100);
    expect(afaForYear(a, 2004).amount).toBe(0);
  });

  it("degressiv 5 % vom Restwert, erstes Jahr monatsgenau", () => {
    const a = { basis: 400_000, start: d("2024-07-01"), degressive: true };
    expect(afaForYear(a, 2024).amount).toBe(10_000); // 20.000 × 6/12
    expect(afaForYear(a, 2025)).toMatchObject({ amount: 19_500, restBefore: 390_000 }); // 5 % von 390.000
    expect(afaForYear(a, 2026).amount).toBe(18_525); // 5 % von 370.500
  });
});
