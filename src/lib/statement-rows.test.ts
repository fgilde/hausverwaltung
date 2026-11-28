import { describe, it, expect } from "vitest";
import { statementRows } from "./statement-rows";
import type { StatementItem } from "@/lib/allocation/statement";

const item = (o: Partial<StatementItem>): StatementItem => ({
  costId: "c", part: "full", method: "AREA", total: 1800, totalBasis: 211, unitBasis: 62.5, leaseFactor: 1, apportion: "months", amount: 533.18, ...o,
});

describe("Zeilen der Einzelabrechnung (#94)", () => {
  const costs = [{ id: "c", type: "GRUNDSTEUER", note: null }, { id: "h", type: "HEIZUNG", note: "Gas" }];
  const label = (k: string) => ({ GRUNDSTEUER: "Grundsteuer", HEIZUNG: "Heizung" })[k] ?? k;

  it("Fläche mit Basis und Monatsanteil", () => {
    expect(statementRows([item({})], costs, label, 12)[0]).toEqual({
      label: "Grundsteuer", total: 1800, key: "Wohnfläche", basis: "62,50 m² von 211,00 m²", share: "12/12", amount: 533.18,
    });
  });
  it("Heizkosten getrennt, Notiz im Namen, Verbrauchsanteil in %", () => {
    const r = statementRows([item({ costId: "h", part: "consumption", method: "CONSUMPTION", apportion: "consumption", leaseFactor: 0.5, unitBasis: 930, totalBasis: 2280 })], costs, label, 6)[0];
    expect(r.label).toBe("Heizung (Gas) – Verbrauchskosten");
    expect(r.basis).toBe("930,00 von 2.280,00");
    expect(r.share).toBe("50 %");
  });
  it("Personen mit Zeitscheiben: Personenjahre, tagesgenau", () => {
    const r = statementRows([item({ method: "PERSONS", apportion: "persons", unitBasis: 1.4959, totalBasis: 5.5 })], costs, label, 12)[0];
    expect(r.basis).toBe("1,50 von 5,50 Personenjahren");
    expect(r.share).toBe("tagesgenau");
  });
});
