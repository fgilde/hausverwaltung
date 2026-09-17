import { describe, it, expect } from "vitest";
import { buildStatement, monthsActiveInYear } from "./statement";

const d = (s: string) => new Date(s + "T00:00:00Z");

// Kurzschreibweise: ein ganzjähriges Mietverhältnis (12 Monate).
const fy = (id: string, prepayment = 0) => [{ id, monthsActive: 12, prepayment }];

describe("monthsActiveInYear (#8 anteilige Vorauszahlung)", () => {
  it("ganzjährig = 12", () => {
    expect(monthsActiveInYear(d("2020-01-01"), null, 2026)).toBe(12);
  });
  it("Mietbeginn 01.09. = 4 Monate (Sep–Dez)", () => {
    expect(monthsActiveInYear(d("2026-09-01"), null, 2026)).toBe(4);
  });
  it("Mietende 31.03. = 3 Monate (Jan–Mär)", () => {
    expect(monthsActiveInYear(d("2020-01-01"), d("2026-03-31"), 2026)).toBe(3);
  });
  it("außerhalb des Jahres = 0", () => {
    expect(monthsActiveInYear(d("2027-01-01"), null, 2026)).toBe(0);
    expect(monthsActiveInYear(d("2020-01-01"), d("2025-12-31"), 2026)).toBe(0);
  });
  it("Beginn Mitte Monat zählt den Monat", () => {
    expect(monthsActiveInYear(d("2026-09-15"), null, 2026)).toBe(4);
  });
});

describe("buildStatement", () => {
  const units = [
    { id: "a", label: "A", area: 50, persons: 1, leases: fy("la", 300) },
    { id: "b", label: "B", area: 50, persons: 3, leases: fy("lb", 300) },
  ];

  it("legt nach Fläche gleich um und rechnet Saldo", () => {
    const { lines, totalUmlage } = buildStatement(units, [
      { id: "c1", amount: 1000, method: "AREA", umlagefaehig: true },
    ]);
    expect(totalUmlage).toBe(1000);
    expect(lines[0].allocated).toBe(500);
    expect(lines[1].allocated).toBe(500);
    expect(lines[0].balance).toBe(-200); // 300 VZ - 500 = -200 Nachzahlung
    expect(lines[0].leaseId).toBe("la");
  });

  it("legt nach Personen um (1:3)", () => {
    const { lines } = buildStatement(units, [
      { id: "c1", amount: 400, method: "PERSONS", umlagefaehig: true },
    ]);
    expect(lines[0].allocated).toBe(100);
    expect(lines[1].allocated).toBe(300);
  });

  it("ignoriert nicht umlagefähige Kosten", () => {
    const { totalUmlage, lines } = buildStatement(units, [
      { id: "c1", amount: 500, method: "AREA", umlagefaehig: false },
    ]);
    expect(totalUmlage).toBe(0);
    expect(lines[0].allocated).toBe(0);
    expect(lines[0].balance).toBe(300); // volle VZ = Guthaben
  });

  it("summiert mehrere Kostenarten cent-genau", () => {
    const { lines } = buildStatement(units, [
      { id: "c1", amount: 1000, method: "AREA", umlagefaehig: true },
      { id: "c2", amount: 400, method: "PERSONS", umlagefaehig: true },
    ]);
    const sum = lines.reduce((a, l) => a + l.allocated, 0);
    expect(Math.round(sum * 100) / 100).toBe(1400);
  });

  it("HeizkostenV: 30% Fläche + 70% Verbrauch", () => {
    const heizUnits = [
      { id: "a", label: "A", area: 50, persons: 1, consumption: 30, leases: fy("la") },
      { id: "b", label: "B", area: 50, persons: 1, consumption: 70, leases: fy("lb") },
    ];
    const { lines } = buildStatement(heizUnits, [
      { id: "h", amount: 1000, method: "CONSUMPTION", umlagefaehig: true, heating: true },
    ]);
    // Grundkosten 300 → 150/150 (Fläche gleich), Verbrauch 700 → 210/490 (30:70)
    expect(lines[0].allocated).toBe(360);
    expect(lines[1].allocated).toBe(640);
  });

  it("HeizkostenV: consumptionShare 100% = rein nach Verbrauch", () => {
    const heizUnits = [
      { id: "a", label: "A", area: 50, persons: 1, consumption: 30, leases: fy("la") },
      { id: "b", label: "B", area: 50, persons: 1, consumption: 70, leases: fy("lb") },
    ];
    const { lines } = buildStatement(heizUnits, [
      { id: "h", amount: 1000, method: "CONSUMPTION", umlagefaehig: true, heating: true, consumptionShare: 1 },
    ]);
    expect(lines[0].allocated).toBe(300); // 30 %
    expect(lines[1].allocated).toBe(700); // 70 %
  });

  it("HeizkostenV: consumptionShare 50% (Fläche 250/250 + Verbrauch 150/350)", () => {
    const heizUnits = [
      { id: "a", label: "A", area: 50, persons: 1, consumption: 30, leases: fy("la") },
      { id: "b", label: "B", area: 50, persons: 1, consumption: 70, leases: fy("lb") },
    ];
    const { lines } = buildStatement(heizUnits, [
      { id: "h", amount: 1000, method: "CONSUMPTION", umlagefaehig: true, heating: true, consumptionShare: 0.5 },
    ]);
    expect(lines[0].allocated).toBe(400);
    expect(lines[1].allocated).toBe(600);
  });

  it("HeizkostenV: ohne Verbrauchsdaten Fallback auf Fläche", () => {
    const { lines } = buildStatement(units, [
      { id: "h", amount: 1000, method: "CONSUMPTION", umlagefaehig: true, heating: true },
    ]);
    expect(lines[0].allocated).toBe(500);
    expect(lines[1].allocated).toBe(500);
  });

  describe("#12 Zeitanteil bei unterjährigem Mietverhältnis", () => {
    it("monthsActive 4 kürzt zeitanteilige Kosten auf 4/12", () => {
      // Beispiel aus Issue: eine Wohnung, 1200 € nach Einheit, Mietbeginn 01.09.
      const { lines } = buildStatement(
        [{ id: "a", label: "A", area: 50, persons: 1, leases: [{ id: "l", monthsActive: 4, prepayment: 0 }] }],
        [{ id: "c1", amount: 1200, method: "UNITS", umlagefaehig: true }],
      );
      expect(lines[0].allocated).toBe(400); // 1200 * 4/12
    });

    it("ganzjährig kürzt nicht", () => {
      const { lines } = buildStatement(
        [{ id: "a", label: "A", area: 50, persons: 1, leases: fy("l") }],
        [{ id: "c1", amount: 1200, method: "UNITS", umlagefaehig: true }],
      );
      expect(lines[0].allocated).toBe(1200);
    });

    it("Verbrauchskosten bleiben bei einer Lease ungekürzt, nur Grundkosten anteilig", () => {
      // 1000 € Heizung: 300 Grundkosten (Fläche, kürzbar) + 700 Verbrauch (fix).
      // monthsActive 6 → Grundkosten 150, Verbrauch 700 unverändert.
      const heizUnits = [
        { id: "a", label: "A", area: 50, persons: 1, consumption: 100, leases: [{ id: "l", monthsActive: 6, prepayment: 0 }] },
      ];
      const { lines } = buildStatement(heizUnits, [
        { id: "h", amount: 1000, method: "CONSUMPTION", umlagefaehig: true, heating: true },
      ]);
      expect(lines[0].allocated).toBe(850); // 300*0.5 + 700
    });

    it("kein Vertrag (Leerstand) → eine Zeile, nichts umgelegt", () => {
      const { lines } = buildStatement(
        [{ id: "a", label: "A", area: 50, persons: 1, leases: [] }],
        [{ id: "c1", amount: 1200, method: "AREA", umlagefaehig: true }],
      );
      expect(lines).toHaveLength(1);
      expect(lines[0].leaseId).toBeNull();
      expect(lines[0].allocated).toBe(0);
    });
  });

  describe("#20 Mieterwechsel innerhalb des Abrechnungsjahres", () => {
    it("zwei Verträge (Jan–Jun / Jul–Dez) teilen 1200 € vollständig auf", () => {
      const { lines, totalUmlage } = buildStatement(
        [
          {
            id: "a",
            label: "A",
            area: 50,
            persons: 1,
            leases: [
              { id: "mieterA", monthsActive: 6, prepayment: 300 },
              { id: "mieterB", monthsActive: 6, prepayment: 300 },
            ],
          },
        ],
        [{ id: "c1", amount: 1200, method: "UNITS", umlagefaehig: true }],
      );
      expect(totalUmlage).toBe(1200);
      expect(lines).toHaveLength(2);
      expect(lines[0].leaseId).toBe("mieterA");
      expect(lines[1].leaseId).toBe("mieterB");
      expect(lines[0].allocated).toBe(600);
      expect(lines[1].allocated).toBe(600);
      // Summe geht voll auf — nichts verschwindet.
      expect(lines[0].allocated + lines[1].allocated).toBe(1200);
      expect(lines[0].balance).toBe(-300); // 300 VZ - 600
    });

    it("Wechsel mit Leerstand dazwischen: Vermieter trägt die Lücke", () => {
      // A Jan–Apr (4M), B Sep–Dez (4M), Mai–Aug leer (4M). 1200 € nach Einheit.
      const { lines } = buildStatement(
        [
          {
            id: "a",
            label: "A",
            area: 50,
            persons: 1,
            leases: [
              { id: "A", monthsActive: 4, prepayment: 0 },
              { id: "B", monthsActive: 4, prepayment: 0 },
            ],
          },
        ],
        [{ id: "c1", amount: 1200, method: "UNITS", umlagefaehig: true }],
      );
      expect(lines[0].allocated).toBe(400); // 1200 * 4/12
      expect(lines[1].allocated).toBe(400);
      // 400 € (4 Monate Leerstand) bleiben beim Vermieter — nicht auf Mieter verteilt.
      expect(lines[0].allocated + lines[1].allocated).toBe(800);
    });

    it("Verbrauchskosten werden bei Wechsel nach Monaten geteilt", () => {
      // Volles Jahr, zwei Mieter je 6 Monate. Reine Verbrauchsheizung 1000 €.
      const { lines } = buildStatement(
        [
          {
            id: "a",
            label: "A",
            area: 50,
            persons: 1,
            consumption: 100,
            leases: [
              { id: "A", monthsActive: 6, prepayment: 0 },
              { id: "B", monthsActive: 6, prepayment: 0 },
            ],
          },
        ],
        [{ id: "h", amount: 1000, method: "CONSUMPTION", umlagefaehig: true, heating: true, consumptionShare: 1 }],
      );
      expect(lines[0].allocated).toBe(500);
      expect(lines[1].allocated).toBe(500);
    });
  });
});
