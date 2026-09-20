import { describe, it, expect } from "vitest";
import { dunningDocument } from "./dunning";

const base = {
  propertyName: "Haus A",
  unitLabel: "EG Links",
  renterName: "Max Mustermann",
  tenantName: "Verwaltung Muster",
  chargeTypeLabel: "Miete",
  period: new Date("2026-05-01T00:00:00Z"),
  dueDate: new Date("2026-05-03T00:00:00Z"),
  open: 800,
  fee: 5,
};

describe("dunningDocument (#28)", () => {
  it("Stufe 1 = Zahlungserinnerung", () => {
    expect(dunningDocument({ ...base, level: 1 }).title).toBe("Zahlungserinnerung");
  });

  it("Stufe 2 = 2. Mahnung", () => {
    expect(dunningDocument({ ...base, level: 2 }).title).toBe("2. Mahnung");
  });

  it("summiert offenen Betrag + Mahngebühr", () => {
    const text = dunningDocument({ ...base, level: 2 }).lines.join("\n");
    expect(text).toContain("Max Mustermann");
    expect(text).toContain("Haus A · EG Links");
    expect(text).toContain("Mahngebuehr");
    // Gesamt 805 €
    expect(text).toContain("805");
  });

  it("ohne Gebühr keine Mahngebühr-Zeile", () => {
    const text = dunningDocument({ ...base, level: 1, fee: 0 }).lines.join("\n");
    expect(text).not.toContain("Mahngebuehr");
  });
});
