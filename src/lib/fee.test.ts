import { describe, it, expect } from "vitest";
import { computeMgmtFee } from "./fee";

describe("computeMgmtFee", () => {
  const base = { unitCount: 4, monthlyRentSum: 3000 };

  it("PAUSCHAL = fester Betrag", () => {
    expect(computeMgmtFee({ feeType: "PAUSCHAL", feeValue: 120 }, base)).toBe(120);
  });

  it("PRO_EINHEIT = Betrag × Einheiten", () => {
    expect(computeMgmtFee({ feeType: "PRO_EINHEIT", feeValue: 25 }, base)).toBe(100);
  });

  it("PROZENT = Anteil der Sollmiete", () => {
    expect(computeMgmtFee({ feeType: "PROZENT", feeValue: 3.5 }, base)).toBe(105);
  });
});
