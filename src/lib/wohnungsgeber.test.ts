import { describe, it, expect } from "vitest";
import { wohnungsgeberDocument } from "./wohnungsgeber";

describe("wohnungsgeberDocument (#27)", () => {
  const doc = wohnungsgeberDocument({
    landlordName: "Hausverwaltung Muster",
    landlordAddress: "Hauptstr. 1, 12345 Berlin",
    tenantNames: ["Max Mustermann", "Erika Mustermann"],
    dwellingAddress: "Beispielweg 5, 12345 Berlin · Whg 3",
    moveInDate: new Date("2026-03-15T00:00:00Z"),
  });

  it("nennt § 19 BMG", () => {
    expect(doc.title).toBe("Wohnungsgeberbestätigung");
    expect(doc.lines.some((l) => l.includes("§ 19"))).toBe(true);
  });

  it("enthält Wohnungsgeber, Wohnung, Mieter und Einzugsdatum", () => {
    const text = doc.lines.join("\n");
    expect(text).toContain("Hausverwaltung Muster");
    expect(text).toContain("Beispielweg 5, 12345 Berlin · Whg 3");
    expect(text).toContain("Max Mustermann");
    expect(text).toContain("Erika Mustermann");
    expect(text).toContain("15.3.2026"); // date() de-Format
  });

  it("ohne Mieter/Datum bleibt robust", () => {
    const d = wohnungsgeberDocument({
      landlordName: "V",
      landlordAddress: "A",
      tenantNames: [],
      dwellingAddress: "W",
      moveInDate: null,
    });
    const text = d.lines.join("\n");
    expect(text).toContain("Einzugsdatum: —");
    expect(text).toContain("Meldepflichtige Person(en):");
  });
});
