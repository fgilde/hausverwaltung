import { describe, it, expect } from "vitest";
import { toDatevExtf } from "./datev";

describe("toDatevExtf", () => {
  const out = toDatevExtf(
    [
      { amount: 850, debitCredit: "S", account: "1200", contraAccount: "8000", date: "2026-02-15", text: "Miete Febr", invoiceField: "RE-1" },
      { amount: 120.5, debitCredit: "H", account: "1200", contraAccount: "4980", date: "2026-03-01", text: "Ausgabe" },
    ],
    {
      wjBeginn: new Date(Date.UTC(2026, 0, 1)),
      datumVon: new Date(Date.UTC(2026, 0, 1)),
      datumBis: new Date(Date.UTC(2026, 11, 31)),
      now: new Date(Date.UTC(2026, 1, 20, 10, 30, 0, 0)),
      bezeichnung: "Test",
    },
  );
  const lines = out.trimEnd().split("\r\n");

  it("Header-Zeile im EXTF-700-Format", () => {
    expect(lines[0].startsWith('"EXTF";700;21;"Buchungsstapel";13;')).toBe(true);
    expect(lines[0].split(";").length).toBe(31);
    expect(lines[0]).toContain("20260101"); // WJ-Beginn
  });

  it("Feldnamen-Zeile + Datenzeilen", () => {
    expect(lines[1].startsWith('"Umsatz (ohne Soll/Haben-Kz)";"Soll/Haben-Kennzeichen"')).toBe(true);
    expect(lines).toHaveLength(4);
    // Umsatz mit Komma, Belegdatum TTMM, Text gequotet
    expect(lines[2].startsWith("850,00;S;")).toBe(true);
    expect(lines[2]).toContain(";1502;"); // 15.02. -> TTMM
    expect(lines[2]).toContain('"Miete Febr"');
    expect(lines[3].startsWith("120,50;H;")).toBe(true);
  });
});
