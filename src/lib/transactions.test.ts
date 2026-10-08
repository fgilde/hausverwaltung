import { describe, it, expect } from "vitest";
import { summarizeTransactions, parseAmount, txnWhere } from "./transactions";

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

describe("Transaktionsfilter (#62)", () => {
  it("Beträge deutsch und englisch", () => {
    expect(parseAmount("1.234,56")).toBe(1234.56);
    expect(parseAmount("12.5")).toBe(12.5);
    expect(parseAmount("850 €")).toBe(850);
    expect(parseAmount("")).toBeUndefined();
    expect(parseAmount("abc")).toBeUndefined();
  });
  it("baut das where", () => {
    expect(txnWhere({})).toEqual({});
    const w = txnWhere({ acc: "a1", dir: "EINGANG", from: "2026-01-01", to: "2026-01-31", min: "100", q: " Müller " });
    expect(w).toMatchObject({ accountId: "a1", direction: "EINGANG", amount: { gte: 100 } });
    expect(w.date).toEqual({ gte: new Date("2026-01-01T00:00:00Z"), lt: new Date("2026-02-01T00:00:00Z") });
    expect(w.OR?.[0]).toEqual({ counterparty: { contains: "Müller", mode: "insensitive" } });
    expect(txnWhere({ dir: "x", from: "kaputt" })).toEqual({});
  });
});
