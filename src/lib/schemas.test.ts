import { describe, it, expect } from "vitest";
import { unitSchema, unitUpdateSchema, buildingSchema, buildingUpdateSchema, ownerSchema, propertySchema, parseDecimal } from "./schemas";

describe("unit schemas", () => {
  const base = { label: "WE1", type: "WOHNUNG", area: "72.5" };

  it("create verlangt buildingId", () => {
    expect(unitSchema.safeParse(base).success).toBe(false);
    expect(unitSchema.safeParse({ ...base, buildingId: "b1" }).success).toBe(true);
  });

  it("update akzeptiert OHNE buildingId (Regression: Fläche änderbar)", () => {
    const r = unitUpdateSchema.safeParse({ ...base, area: "80" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.area).toBe(80);
  });
});

describe("building schemas", () => {
  it("create verlangt propertyId", () => {
    expect(buildingSchema.safeParse({ name: "Haus A" }).success).toBe(false);
    expect(buildingSchema.safeParse({ name: "Haus A", propertyId: "p1" }).success).toBe(true);
  });

  it("update akzeptiert nur name (Regression #5: Umbenennen ohne propertyId)", () => {
    const r = buildingUpdateSchema.safeParse({ name: "Haus B" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.name).toBe("Haus B");
  });
});

describe("Dezimalzahlen / MEA (#40)", () => {
  const base = { buildingId: "b1", label: "WE1", type: "WOHNUNG", area: "60" };
  it("parseDecimal akzeptiert Punkt, Komma und deutsches Tausenderformat", () => {
    expect(parseDecimal("53.9")).toBe(53.9);
    expect(parseDecimal("53,9")).toBe(53.9);
    expect(parseDecimal("1.000,5")).toBe(1000.5);
    expect(Number.isNaN(parseDecimal("abc"))).toBe(true);
  });
  it("Einheit: MEA mit Nachkommastellen, Komma erlaubt, auf 4 Stellen gerundet", () => {
    expect(unitSchema.parse({ ...base, mea: "124,55" }).mea).toBe(124.55);
    expect(unitSchema.parse({ ...base, mea: "1.123456" }).mea).toBe(1.1235);
    expect(unitSchema.parse({ ...base, mea: "" }).mea).toBeUndefined();
    expect(unitSchema.safeParse({ ...base, mea: "-1" }).success).toBe(false);
    expect(unitSchema.safeParse({ ...base, mea: "x" }).success).toBe(false);
  });
  it("Eigentümer-Anteil dezimal, 0 < share ≤ 1000", () => {
    expect(ownerSchema.parse({ personId: "p", unitId: "u", share: "333,3333" }).share).toBe(333.3333);
    expect(ownerSchema.safeParse({ personId: "p", unitId: "u", share: "0" }).success).toBe(false);
    expect(ownerSchema.safeParse({ personId: "p", unitId: "u", share: "1000.1" }).success).toBe(false);
  });
  it("Objekt: MEA-Summe dezimal", () => {
    const r = propertySchema.safeParse({ name: "A", street: "S", zip: "1", city: "C", type: "WOHNEN", management: "WEG", meaTotal: "10000,5", feeType: "PAUSCHAL" });
    expect(r.success && r.data.meaTotal).toBe(10000.5);
  });
});
