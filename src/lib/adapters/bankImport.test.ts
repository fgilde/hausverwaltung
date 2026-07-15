import { describe, it, expect } from "vitest";
import { parseCamt053 } from "./bankImport";

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02">
  <BkToCstmrStmt>
    <Stmt>
      <Ntry>
        <Amt Ccy="EUR">780.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <BookgDt><Dt>2026-07-03</Dt></BookgDt>
        <NtryDtls><TxDtls><RmtInf><Ustrd>Miete Juli EG links</Ustrd></RmtInf></TxDtls></NtryDtls>
      </Ntry>
      <Ntry>
        <Amt Ccy="EUR">120.50</Amt>
        <CdtDbtInd>DBIT</CdtDbtInd>
        <ValDt><Dt>2026-07-05</Dt></ValDt>
      </Ntry>
    </Stmt>
  </BkToCstmrStmt>
</Document>`;

describe("parseCamt053", () => {
  it("liest Buchungen mit Betrag, Richtung, Datum, Zweck", () => {
    const e = parseCamt053(SAMPLE);
    expect(e).toHaveLength(2);
    expect(e[0]).toEqual({
      date: "2026-07-03",
      amount: 780,
      direction: "EINGANG",
      reference: "Miete Juli EG links",
    });
    expect(e[1].direction).toBe("AUSGANG");
    expect(e[1].amount).toBe(120.5);
    expect(e[1].reference).toBeUndefined();
  });

  it("verkraftet leeres Dokument", () => {
    expect(parseCamt053("<Document></Document>")).toEqual([]);
  });
});
