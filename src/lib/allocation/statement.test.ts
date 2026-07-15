import { describe, it, expect } from "vitest";
import { buildStatement } from "./statement";

describe("buildStatement", () => {
  const units = [
    { id: "a", label: "A", area: 50, persons: 1, prepayment: 300 },
    { id: "b", label: "B", area: 50, persons: 3, prepayment: 300 },
  ];

  it("legt nach Fläche gleich um und rechnet Saldo", () => {
    const { lines, totalUmlage } = buildStatement(units, [
      { id: "c1", amount: 1000, method: "AREA", umlagefaehig: true },
    ]);
    expect(totalUmlage).toBe(1000);
    expect(lines[0].allocated).toBe(500);
    expect(lines[1].allocated).toBe(500);
    expect(lines[0].balance).toBe(-200); // 300 VZ - 500 = -200 Nachzahlung
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
});
