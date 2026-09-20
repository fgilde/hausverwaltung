import { describe, it, expect } from "vitest";
import { summarizeTransactions } from "./transactions";

describe("summarizeTransactions (#23 Kontobewegungen)", () => {
  it("summiert Ein-/Ausgänge und Saldo", () => {
    const s = summarizeTransactions([
      { direction: "EINGANG", amount: 1000 },
      { direction: "EINGANG", amount: 150.5 },
      { direction: "AUSGANG", amount: 400 },
    ]);
    expect(s.inTotal).toBe(1150.5);
    expect(s.outTotal).toBe(400);
    expect(s.net).toBe(750.5);
    expect(s.count).toBe(3);
  });

  it("leere Liste = 0", () => {
    expect(summarizeTransactions([])).toEqual({ inTotal: 0, outTotal: 0, net: 0, count: 0 });
  });
});
