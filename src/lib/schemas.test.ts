import { describe, it, expect } from "vitest";
import { unitSchema, unitUpdateSchema, buildingSchema, buildingUpdateSchema } from "./schemas";

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
