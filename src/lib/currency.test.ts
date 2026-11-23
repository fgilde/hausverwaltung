import { describe, expect, it } from "vitest";
import { parseCamt053 } from "@/lib/adapters/bankImport";
import { matchesLedgerCurrency } from "@/lib/currency";
import { money } from "@/lib/format";
import { simplePdf } from "@/lib/pdf";

describe("CZK ledger", () => {
  it("formats the original value in CZK and preserves the default EUR behavior", () => {
    expect(money(1234.5, "en", "CZK")).toBe("1\u00a0234,50\u00a0Kč");
    expect(money(1234.5, "en", "CZK", true)).toBe("1\u00a0234,50\u00a0CZK");
    expect(simplePdf("Statement", [money(1234.5, "en", "CZK", true)]).toString("latin1"))
      .toContain("1\u00a0234,50\u00a0CZK");
    expect(money(1234.5, "en")).toBe("€1,234.50");
  });

  it("keeps the declared CAMT currency and rejects a mixed-currency CZK import", () => {
    const xml = `<Document><BkToCstmrStmt><Stmt>
      <Acct><Ccy>CZK</Ccy></Acct>
      <Ntry><Amt Ccy="CZK">1234.50</Amt></Ntry>
      <Ntry><Amt Ccy="EUR">1234.50</Amt></Ntry>
      <Ntry><Amt>25.00</Amt></Ntry>
    </Stmt></BkToCstmrStmt></Document>`;
    const entries = parseCamt053(xml);
    expect(entries.map(({ amount, currency }) => [amount, currency]))
      .toEqual([[1234.5, "CZK"], [1234.5, "EUR"], [25, "CZK"]]);
    expect(entries.every((entry) => matchesLedgerCurrency(entry.currency, "CZK"))).toBe(false);
    expect(matchesLedgerCurrency(undefined, "CZK")).toBe(false);
    expect(matchesLedgerCurrency(undefined, "EUR")).toBe(true);
  });
});
