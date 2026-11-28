import { describe, it, expect } from "vitest";
import { buildStatement, monthsActiveInYear, personSlices, leaseYearShare } from "./statement";

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

describe("buildStatement mit Verteilerkreis (#42)", () => {
  it("Position mit unitIds wird nur auf diese Einheiten verteilt", () => {
    const units = [
      { id: "a", label: "A", area: 50, persons: 1, leases: fy("la") },
      { id: "b", label: "B", area: 50, persons: 1, leases: fy("lb") },
      { id: "c", label: "C", area: 100, persons: 1, leases: fy("lc") },
    ];
    const { lines } = buildStatement(units, [
      { id: "trh", amount: 300, method: "AREA", umlagefaehig: true, unitIds: ["a", "b"] },
    ]);
    const by = Object.fromEntries(lines.map((l) => [l.unitId, l.allocated]));
    expect(by).toEqual({ a: 150, b: 150, c: 0 });
  });
});

describe("Einzelabrechnung (#94)", () => {
  it("Rechenschritte je Position, Summe = umgelegte Kosten", () => {
    const { lines } = buildStatement(
      [
        { id: "a", label: "A", area: 60, persons: 1, consumption: 30, leases: [{ id: "la", monthsActive: 6, prepayment: 0 }] },
        { id: "b", label: "B", area: 40, persons: 2, consumption: 70, leases: fy("lb") },
      ],
      [
        { id: "grund", amount: 333.33, method: "AREA", umlagefaehig: true },
        { id: "heiz", amount: 1000, method: "CONSUMPTION", umlagefaehig: true, heating: true },
      ],
    );
    const a = lines[0];
    expect(a.items.map((i) => [i.costId, i.part, i.method])).toEqual([
      ["grund", "full", "AREA"],
      ["heiz", "base", "AREA"],
      ["heiz", "consumption", "CONSUMPTION"],
    ]);
    const grund = a.items[0];
    expect(grund).toMatchObject({ total: 333.33, totalBasis: 100, unitBasis: 60, leaseFactor: 0.5 });
    expect(grund.amount).toBe(100); // 333,33 · 60/100 = 200 → halbes Jahr = 100
    const sum = a.items.reduce((s, i) => s + Math.round(i.amount * 100), 0);
    expect(sum).toBe(Math.round(a.allocated * 100));
  });
});

describe("Personen mit Zeitraum (#90)", () => {
  // Beispiel aus dem Issue: Wohnung A bis Juni 2 Personen (Vormieter), ab Juli 1 Person
  // (Nachmieter); Wohnung B ganzjährig 2 Personen. 1200 € nach Personen.
  const half = 181 / 365;
  const units = [
    {
      id: "a", label: "A", area: 50, persons: 1,
      personSlices: [
        { leaseId: "vor", persons: 2, fraction: half },
        { leaseId: "nach", persons: 1, fraction: 1 - half },
      ],
      leases: [
        { id: "vor", monthsActive: 6, prepayment: 0 },
        { id: "nach", monthsActive: 6, prepayment: 0 },
      ],
    },
    { id: "b", label: "B", area: 50, persons: 2, personSlices: [{ leaseId: "lb", persons: 2, fraction: 1 }], leases: fy("lb") },
  ];

  it("rechnet Personen-Tage statt Personenzahl des letzten Vertrags", () => {
    const { lines } = buildStatement(units, [{ id: "w", amount: 1200, method: "PERSONS", umlagefaehig: true }]);
    const by = Object.fromEntries(lines.map((l) => [l.leaseId, l.allocated]));
    const totalPY = 2 * half + (1 - half) + 2;
    expect(by.vor).toBeCloseTo((1200 * 2 * half) / totalPY, 1);
    expect(by.nach).toBeCloseTo((1200 * (1 - half)) / totalPY, 1);
    expect(by.lb).toBeCloseTo((1200 * 2) / totalPY, 1);
    expect(Math.round((by.vor + by.nach + by.lb) * 100)).toBe(120000);
    // Vormieter trägt mehr als der Nachmieter, obwohl beide 6 Monate wohnen
    expect(by.vor).toBeGreaterThan(by.nach);
  });

  it("Leerstand trägt der Vermieter (keine Zeile, Personen der Leerstandsscheibe)", () => {
    const { lines } = buildStatement(
      [
        { id: "a", label: "A", area: 50, persons: 1, personSlices: [{ leaseId: "la", persons: 2, fraction: 0.5 }, { leaseId: null, persons: 1, fraction: 0.5 }], leases: [{ id: "la", monthsActive: 6, prepayment: 0 }] },
        { id: "b", label: "B", area: 50, persons: 2, personSlices: [{ leaseId: "lb", persons: 2, fraction: 1 }], leases: fy("lb") },
      ],
      [{ id: "w", amount: 350, method: "PERSONS", umlagefaehig: true }],
    );
    // Gewichte: A = 2·0,5 + 1·0,5 = 1,5 (davon Mieter 1), B = 2 → A-Mieter 100, B 200, Leerstand 50
    expect(lines.map((l) => l.allocated)).toEqual([100, 200]);
  });

  it("Personenzahl 0 (z. B. Stellplatz, #104) trägt nichts", () => {
    const { lines } = buildStatement(
      [
        { id: "w", label: "W", area: 50, persons: 2, leases: fy("lw") },
        { id: "s", label: "S", area: 12, persons: 0, leases: fy("ls") },
      ],
      [{ id: "m", amount: 100, method: "PERSONS", umlagefaehig: true }],
    );
    expect(lines.map((l) => l.allocated)).toEqual([100, 0]);
  });
});

describe("personSlices (#90)", () => {
  it("Mieterwechsel zum 01.07. tagesgenau", () => {
    const s = personSlices(
      [
        { id: "vor", startDate: d("2020-01-01"), endDate: d("2026-06-30"), personCount: 2 },
        { id: "nach", startDate: d("2026-07-01"), endDate: null, personCount: 1 },
      ],
      2026,
    );
    expect(s).toEqual([
      { leaseId: "vor", persons: 2, fraction: 181 / 365 },
      { leaseId: "nach", persons: 1, fraction: 184 / 365 },
    ]);
  });

  it("Änderung im laufenden Vertrag (Partner zieht am 01.10. ein)", () => {
    const s = personSlices(
      [{ id: "l", startDate: d("2024-05-01"), endDate: null, personCount: 1, occupancies: [{ validFrom: d("2026-10-01"), persons: 2 }] }],
      2026,
    );
    expect(s).toEqual([
      { leaseId: "l", persons: 1, fraction: 273 / 365 },
      { leaseId: "l", persons: 2, fraction: 92 / 365 },
    ]);
  });

  it("frühere Änderung gilt ab Jahresbeginn, Leerstand mit letzter Personenzahl", () => {
    const s = personSlices(
      [{ id: "l", startDate: d("2020-01-01"), endDate: d("2026-03-31"), personCount: 1, occupancies: [{ validFrom: d("2023-01-01"), persons: 3 }] }],
      2026,
    );
    expect(s).toEqual([
      { leaseId: "l", persons: 3, fraction: 90 / 365 },
      { leaseId: null, persons: 1, fraction: 275 / 365 },
    ]);
  });
});

describe("Mieterwechsel im Monat und Pauschale (#108, #110)", () => {
  const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

  it("leaseYearShare: ganze Monate wie bisher, Wechsel am 15. nach Tagen", () => {
    expect(leaseYearShare(d("2026-01-01"), d("2026-07-31"), 2026)).toEqual({ fraction: 7 / 12, label: "7/12" });
    expect(leaseYearShare(d("2026-01-01"), d("2026-08-14"), 2026)).toEqual({ fraction: 226 / 365, label: "226/365 Tage" });
    expect(leaseYearShare(d("2026-08-15"), null, 2026)).toEqual({ fraction: 139 / 365, label: "139/365 Tage" });
  });

  it("Wechsel 14./15.08.: die Einheit trägt genau 12/12, nicht 13/12", () => {
    const a = leaseYearShare(d("2026-01-01"), d("2026-08-14"), 2026);
    const b = leaseYearShare(d("2026-08-15"), null, 2026);
    const r = buildStatement(
      [{ id: "z1", label: "Zimmer 1", area: 20, persons: 1, leases: [
        { id: "alt", monthsActive: 8, fraction: a.fraction, prepayment: 0 },
        { id: "neu", monthsActive: 5, fraction: b.fraction, prepayment: 0 },
      ] }],
      [{ id: "k", amount: 365, method: "AREA", umlagefaehig: true }],
    );
    expect(r.lines.map((l) => l.allocated)).toEqual([226, 139]);
  });

  it("Pauschale: Anteil sichtbar, aber kein Saldo", () => {
    const r = buildStatement(
      [{ id: "z1", label: "Zimmer 1", area: 20, persons: 1, leases: [{ id: "p", monthsActive: 12, prepayment: 500, flatRate: true }] }],
      [{ id: "k", amount: 300, method: "AREA", umlagefaehig: true }],
    );
    expect(r.lines[0]).toMatchObject({ allocated: 300, prepayment: 0, balance: 0, flatRate: true });
  });
});
