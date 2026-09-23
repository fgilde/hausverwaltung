import { describe, it, expect } from "vitest";
import { mapColumns, normalizeEnum, missingRequired, PROPERTY_COLS, UNIT_COLS, MANAGEMENT_MAP, UNIT_TYPE_MAP } from "./import-columns";

describe("mapColumns (#33 DE/EN Header)", () => {
  it("englische Property-Header", () => {
    const c = mapColumns(["name", "street", "zip", "city"], PROPERTY_COLS);
    expect(c.name).toBe(0);
    expect(c.street).toBe(1);
    expect(c.zip).toBe(2);
    expect(c.city).toBe(3);
  });

  it("deutsche Property-Header", () => {
    const c = mapColumns(["Objekt", "Straße", "PLZ", "Ort", "Verwaltung"], PROPERTY_COLS);
    expect(c.name).toBe(0);
    expect(c.street).toBe(1);
    expect(c.zip).toBe(2);
    expect(c.city).toBe(3);
    expect(c.management).toBe(4);
  });

  it("deutsche Unit-Header inkl. Fläche/Gebäude", () => {
    const c = mapColumns(["Objekt", "Gebäude", "Bezeichnung", "Fläche", "Zimmer"], UNIT_COLS);
    expect(c.property).toBe(0);
    expect(c.building).toBe(1);
    expect(c.label).toBe(2);
    expect(c.area).toBe(3);
    expect(c.rooms).toBe(4);
  });

  it("fehlende Spalte = -1", () => {
    const c = mapColumns(["foo", "bar"], PROPERTY_COLS);
    expect(c.name).toBe(-1);
  });
});

describe("normalizeEnum", () => {
  it("deutsche Verwaltungsart -> Code", () => {
    expect(normalizeEnum("Miete", MANAGEMENT_MAP, "MIET")).toBe("MIET");
    expect(normalizeEnum("WEG", MANAGEMENT_MAP, "MIET")).toBe("WEG");
  });
  it("deutsche Einheitenart -> Code", () => {
    expect(normalizeEnum("Stellplatz", UNIT_TYPE_MAP, "WOHNUNG")).toBe("STELLPLATZ");
  });
  it("unbekannt -> fallback", () => {
    expect(normalizeEnum("xyz", MANAGEMENT_MAP, "MIET")).toBe("MIET");
    expect(normalizeEnum(undefined, MANAGEMENT_MAP, "MIET")).toBe("MIET");
  });
});

describe("missingRequired (#33 Mapping-Validierung)", () => {
  it("alle Pflichtfelder zugeordnet = leer", () => {
    expect(missingRequired("property", { name: 0, street: 1, zip: 2, city: 3 })).toEqual([]);
  });
  it("fehlende Pflichtfelder werden gelistet", () => {
    expect(missingRequired("property", { name: 0, street: -1, zip: 2, city: -1 })).toEqual(["street", "city"]);
  });
  it("unbekannte Entität", () => {
    expect(missingRequired("foo", {})).toEqual(["__entity__"]);
  });
});
