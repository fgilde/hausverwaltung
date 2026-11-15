import { describe, expect, it } from "vitest";
import { componentAmountAt, monthlyPrepaymentAt, prepaymentForLeaseYear, recurringComponentAmountAt } from "./rent-components";

const d = (value: string) => new Date(`${value}T00:00:00.000Z`);

describe("rent component timelines", () => {
  const components = [
    { type: "NEBENKOSTEN", amount: 220, effectiveDate: null },
    { type: "NEBENKOSTEN", amount: 270, effectiveDate: d("2026-07-01") },
    { type: "HEIZKOSTEN", amount: 0, effectiveDate: null },
    { type: "STELLPLATZ", amount: 60, effectiveDate: null },
  ];

  it("uses the latest service-charge value for each calendar month", () => {
    expect(monthlyPrepaymentAt(components, d("2026-06-01"))).toBe(220);
    expect(monthlyPrepaymentAt(components, d("2026-07-01"))).toBe(270);
  });

  it("calculates 2,940 EUR for a 220 -> 270 EUR change on 1 July", () => {
    expect(prepaymentForLeaseYear(components, d("2026-01-01"), null, 2026)).toBe(2940);
  });

  it("keeps a single legacy component valid for the whole year", () => {
    expect(
      prepaymentForLeaseYear(
        [{ type: "NEBENKOSTEN", amount: 270, effectiveDate: null }],
        d("2026-01-01"),
        null,
        2026,
      ),
    ).toBe(3240);
  });

  it("does not treat parking rent as a service-charge prepayment", () => {
    expect(
      prepaymentForLeaseYear(
        [{ type: "NEBENKOSTEN", amount: 220, effectiveDate: null }, { type: "STELLPLATZ", amount: 60, effectiveDate: null }],
        d("2026-01-01"),
        null,
        2026,
      ),
    ).toBe(2640);
  });

  it("uses the latest current value for the warm-rent display", () => {
    expect(componentAmountAt(components, "NEBENKOSTEN", d("2026-11-01"))).toBe(270);
    expect(recurringComponentAmountAt(components, d("2026-11-01"))).toBe(330);
  });
});
