import { describe, it, expect } from "vitest";
import { insuranceYearAmount } from "./insurance";

const d = (s: string) => new Date(s + "T00:00:00Z");

describe("insuranceYearAmount (#32 unterjährige Versicherungen)", () => {
  it("Beispiel aus dem Issue: zwei Policen ergeben 1350 € für 2026", () => {
    const amount = insuranceYearAmount(
      [
        { premium: 1200, startDate: d("2025-07-01"), endDate: d("2026-06-30") },
        { premium: 1500, startDate: d("2026-07-01"), endDate: d("2027-06-30") },
      ],
      2026,
    );
    expect(amount).toBe(1350); // 1200*6/12 + 1500*6/12
  });

  it("ganzjährige Police zählt voll", () => {
    expect(
      insuranceYearAmount([{ premium: 1200, startDate: d("2026-01-01"), endDate: d("2026-12-31") }], 2026),
    ).toBe(1200);
  });

  it("ohne Datum gilt als ganzjährig", () => {
    expect(insuranceYearAmount([{ premium: 900, startDate: null, endDate: null }], 2026)).toBe(900);
  });

  it("Police komplett außerhalb des Jahres zählt 0", () => {
    expect(
      insuranceYearAmount([{ premium: 1200, startDate: d("2024-01-01"), endDate: d("2024-12-31") }], 2026),
    ).toBe(0);
  });

  it("laufende Police ohne Ende ab unterjährigem Beginn", () => {
    // Beginn 01.10.2026, offen → Okt–Dez = 3 Monate
    expect(
      insuranceYearAmount([{ premium: 1200, startDate: d("2026-10-01"), endDate: null }], 2026),
    ).toBe(300);
  });

  it("mehrere ganzjährige Policen (verschiedene Sparten) summieren", () => {
    expect(
      insuranceYearAmount(
        [
          { premium: 800, startDate: null, endDate: null },
          { premium: 200, startDate: null, endDate: null },
        ],
        2026,
      ),
    ).toBe(1000);
  });
});
