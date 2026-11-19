import type { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { importCamtStatement } from "./camt-import";

const db = vi.hoisted(() => ({
  account: { findFirst: vi.fn() },
  payment: { findMany: vi.fn(), createMany: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { ...db, $transaction: (run: (tx: typeof db) => unknown) => run(db) },
}));

const ACCOUNT_IBAN = "DE00000000000000000001";
const entry = (purpose: string, bankRef?: string) => `<Ntry>
  <Amt Ccy="EUR">812.34</Amt><CdtDbtInd>CRDT</CdtDbtInd><BookgDt><Dt>2025-11-28</Dt></BookgDt>
  ${bankRef ? `<AcctSvcrRef>${bankRef}</AcctSvcrRef>` : ""}
  <NtryDtls><TxDtls><RmtInf><Ustrd>${purpose}</Ustrd></RmtInf></TxDtls></NtryDtls>
</Ntry>`;
const statement = (id: string, entries: string, iban = ACCOUNT_IBAN) =>
  `<Document><BkToCstmrStmt><Stmt><Id>${id}</Id><Acct><Id><IBAN>${iban}</IBAN></Id></Acct>${entries}</Stmt></BkToCstmrStmt></Document>`;

describe("importCamtStatement", () => {
  let stored: Prisma.PaymentCreateManyInput[];

  beforeEach(() => {
    vi.resetAllMocks();
    stored = [];
    db.account.findFirst.mockResolvedValue({ iban: ACCOUNT_IBAN });
    db.payment.findMany.mockImplementation(async ({ where }) => stored.filter((row) =>
      row.tenantId === where.tenantId && where.OR.some(({ accountId }: { accountId: string | null }) => accountId === row.accountId),
    ));
    db.payment.createMany.mockImplementation(async ({ data, skipDuplicates }) => {
      expect(skipDuplicates).toBe(true);
      let count = 0;
      for (const row of data) {
        if (stored.some((old) => old.tenantId === row.tenantId && old.externalId === row.externalId)) continue;
        stored.push(row);
        count++;
      }
      return { count };
    });
  });

  it("skips a repeated statement and never assigns an internal transfer or mixed receipt", async () => {
    const xml = statement("11", entry("Umbuchung Giro an Rücklage", "0007") + entry("Hausgeld und Rücklage WE A"));
    expect(await importCamtStatement("t", "a", xml)).toEqual({ imported: 2, skipped: 0, matched: 0 });
    expect(await importCamtStatement("t", "a", xml)).toEqual({ imported: 0, skipped: 2, matched: 0 });
    expect(stored.map(({ chargeId, reference }) => [chargeId, reference])).toEqual([
      [null, "Umbuchung Giro an Rücklage"],
      [null, "Hausgeld und Rücklage WE A"],
    ]);
  });

  it("keeps two identical entries in a statement without bank references", async () => {
    const repeated = entry("Hausgeld WE A");
    // An export can lack both an entry reference and a statement ID.
    const xml = statement("", repeated + repeated);
    expect((await importCamtStatement("t", "a", xml)).imported).toBe(2);
    expect((await importCamtStatement("t", "a", xml)).skipped).toBe(2);
    expect(new Set(stored.map((row) => row.externalId)).size).toBe(2);
  });

  it("uses stable bank references across statement IDs and scopes them to the account", async () => {
    const first = statement("11", entry("Umbuchung", "0007"));
    const overlap = statement("12", entry("Umbuchung", "0007") + entry("Umbuchung", "0008"));
    expect((await importCamtStatement("t", "a", first)).imported).toBe(1);
    expect((await importCamtStatement("t", "a", overlap)).imported).toBe(1);
    expect((await importCamtStatement("t", "b", first)).imported).toBe(1);
  });

  it("stops before writing anything when a legacy booking might match", async () => {
    stored.push({ tenantId: "t", accountId: null, date: new Date("2025-11-28"), amount: 812.34, direction: "EINGANG", reference: "Umbuchung" });
    const xml = statement("11", entry("Neue Buchung", "0007") + entry("Umbuchung", "0008"));
    await expect(importCamtStatement("t", "a", xml)).rejects.toThrow("Mögliches Duplikat");
    expect(db.payment.createMany).not.toHaveBeenCalled();
  });

  it("stops on an overlapping booking without a stable reference", async () => {
    const booking = entry("Umbuchung");
    await importCamtStatement("t", "a", statement("11", booking));
    await expect(importCamtStatement("t", "a", statement("12", booking))).rejects.toThrow("Mögliches Duplikat");
    expect(stored).toHaveLength(1);
  });

  it("requires a tenant account and rejects an IBAN mismatch", async () => {
    const xml = statement("11", entry("Zahlung"), "DE00000000000000000002");
    await expect(importCamtStatement("t", "", xml)).rejects.toThrow("Konto");
    await expect(importCamtStatement("t", "a", xml)).rejects.toThrow("IBAN");
    expect(db.account.findFirst).toHaveBeenCalledWith({ where: { tenantId: "t", id: "a" }, select: { iban: true } });
    expect(db.payment.createMany).not.toHaveBeenCalled();
  });
});
