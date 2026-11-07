import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/rbac", () => ({}));
const { documentPatch } = await import("./api-write");

describe("documentPatch (#86)", () => {
  it("übernimmt nur gesendete Felder", () => {
    expect(documentPatch({ name: " Scan ", unitId: "u1" })).toEqual({ name: "Scan", unitId: "u1" });
  });

  it("null und leerer String lösen die Zuordnung", () => {
    expect(documentPatch({ propertyId: null, personId: "" })).toEqual({ propertyId: null, personId: null });
  });

  it("prüft Kategorie und Titel", () => {
    expect(documentPatch({ category: "RECHNUNG" })).toEqual({ category: "RECHNUNG" });
    expect(() => documentPatch({ category: "FOO" })).toThrow(/category/);
    expect(() => documentPatch({ name: "  " })).toThrow(/name/);
  });

  it("ignoriert fremde Felder und verlangt mindestens ein änderbares", () => {
    expect(() => documentPatch({ storageKey: "x", tenantId: "t" })).toThrow(/Keine änderbaren Felder/);
  });
});
