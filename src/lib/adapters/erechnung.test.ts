import { describe, it, expect } from "vitest";
import { isEInvoice, parseEInvoice } from "./erechnung";

const CII = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:cefact" xmlns:ram="urn:ram" xmlns:udt="urn:udt">
  <rsm:ExchangedDocument>
    <ram:ID>RE-2026-0042</ram:ID>
    <ram:IssueDateTime><udt:DateTimeString format="102">20260114</udt:DateTimeString></ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty><ram:Name>Hausmeister Service GmbH</ram:Name></ram:SellerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:GrandTotalAmount>1190.00</ram:GrandTotalAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;

const UBL = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis" xmlns:cbc="urn:cbc" xmlns:cac="urn:cac">
  <cbc:ID>2026-XR-7</cbc:ID>
  <cbc:IssueDate>2026-02-03</cbc:IssueDate>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty><cac:Party><cac:PartyName><cbc:Name>Stadtwerke AG</cbc:Name></cac:PartyName></cac:Party></cac:AccountingSupplierParty>
  <cac:LegalMonetaryTotal><cbc:PayableAmount currencyID="EUR">845.50</cbc:PayableAmount></cac:LegalMonetaryTotal>
</Invoice>`;

describe("isEInvoice", () => {
  it("erkennt XML-MIME und typische Dateinamen", () => {
    expect(isEInvoice("application/xml", "rechnung.xml")).toBe(true);
    expect(isEInvoice("application/pdf", "factur-x_beleg.pdf")).toBe(true);
    expect(isEInvoice("application/pdf", "scan.pdf")).toBe(false);
  });
});

describe("parseEInvoice", () => {
  it("parst ZUGFeRD/CII inkl. YYYYMMDD-Datum", () => {
    const r = parseEInvoice(CII)!;
    expect(r.syntax).toBe("CII");
    expect(r.invoiceNumber).toBe("RE-2026-0042");
    expect(r.issueDate).toBe("2026-01-14");
    expect(r.currency).toBe("EUR");
    expect(r.total).toBe(1190);
    expect(r.sellerName).toBe("Hausmeister Service GmbH");
  });

  it("parst XRechnung/UBL inkl. Attribut am Betrag", () => {
    const r = parseEInvoice(Buffer.from(UBL))!;
    expect(r.syntax).toBe("UBL");
    expect(r.invoiceNumber).toBe("2026-XR-7");
    expect(r.issueDate).toBe("2026-02-03");
    expect(r.total).toBe(845.5);
    expect(r.sellerName).toBe("Stadtwerke AG");
  });

  it("liefert null bei Nicht-E-Rechnung", () => {
    expect(parseEInvoice("<foo>bar</foo>")).toBeNull();
  });
});
