import { describe, expect, it } from "vitest";
import { componentActive, monthlyPrepaymentAt, prepaymentForLeaseYear, recurringComponentAmountAt } from "./rent-components";

const d = (value: string) => new Date(`${value}T00:00:00.000Z`);
const c = (type: string, amount: number, effectiveDate: string | null = null, endDate: string | null = null) => ({
  type, amount, effectiveDate: effectiveDate ? d(effectiveDate) : null, endDate: endDate ? d(endDate) : null,
});

describe("rent component timelines (#87)", () => {
  // 220 € bis Juni, ab 1. Juli 270 € (Anpassung beendet den alten Wert zum Vortag)
  const components = [
    c("NEBENKOSTEN", 220, null, "2026-06-30"),
    c("NEBENKOSTEN", 270, "2026-07-01"),
    c("HEIZKOSTEN", 0),
    c("STELLPLATZ", 60),
  ];

  it("uses the value valid in each calendar month", () => {
    expect(monthlyPrepaymentAt(components, d("2026-06-01"))).toBe(220);
    expect(monthlyPrepaymentAt(components, d("2026-07-01"))).toBe(270);
  });

  it("calculates 2,940 EUR for a 220 -> 270 EUR change on 1 July", () => {
    expect(prepaymentForLeaseYear(components, d("2026-01-01"), null, 2026)).toBe(2940);
  });

  it("keeps undated components additive, also of the same type (150 + 20 cable)", () => {
    const legacy = [c("NEBENKOSTEN", 150), c("NEBENKOSTEN", 20)];
    expect(monthlyPrepaymentAt(legacy, d("2026-03-01"))).toBe(170);
    expect(prepaymentForLeaseYear(legacy, d("2026-01-01"), null, 2026)).toBe(2040);
  });

  it("does not treat parking rent as a service-charge prepayment", () => {
    expect(prepaymentForLeaseYear([c("NEBENKOSTEN", 220), c("STELLPLATZ", 60)], d("2026-01-01"), null, 2026)).toBe(2640);
  });

  it("a change in the middle of a month starts with the next month", () => {
    const mid = [c("NEBENKOSTEN", 100, null, "2026-05-14"), c("NEBENKOSTEN", 130, "2026-05-15")];
    expect(monthlyPrepaymentAt(mid, d("2026-05-20"))).toBe(100);
    expect(monthlyPrepaymentAt(mid, d("2026-06-01"))).toBe(130);
  });

  it("an ended component (parking space given up) only counts until its end", () => {
    const parking = c("STELLPLATZ", 60, null, "2026-03-31");
    expect(componentActive(parking, d("2026-03-01"))).toBe(true);
    expect(componentActive(parking, d("2026-04-01"))).toBe(false);
  });

  it("warm-rent components for the current month", () => {
    expect(recurringComponentAmountAt(components, d("2026-11-28"))).toBe(330);
  });
});
