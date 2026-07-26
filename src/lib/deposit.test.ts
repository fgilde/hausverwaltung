import { describe, it, expect } from "vitest";
import { depositInterest } from "./deposit";

describe("depositInterest", () => {
  it("1 Jahr, 2% auf 2400 = 48", () => {
    expect(depositInterest(2400, 2, new Date("2025-01-01"), new Date("2026-01-01"))).toBe(48);
  });

  it("kein Zinssatz = 0", () => {
    expect(depositInterest(2400, null, new Date("2025-01-01"), new Date("2026-01-01"))).toBe(0);
  });

  it("kein Erhalt-Datum = 0", () => {
    expect(depositInterest(2400, 2, null, new Date("2026-01-01"))).toBe(0);
  });

  it("halbes Jahr ~ halber Zins", () => {
    const i = depositInterest(2400, 2, new Date("2025-01-01"), new Date("2025-07-02"));
    expect(i).toBeGreaterThan(23);
    expect(i).toBeLessThan(25);
  });
});
