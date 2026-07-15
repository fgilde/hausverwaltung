// E-Rechnungs-Adapter (XRechnung / ZUGFeRD / Factur-X). Pflicht-Empfang seit 01/2025.
//
// Parst die beiden europäischen Kern-Syntaxen (EN 16931):
//   - CII  (UN/CEFACT Cross Industry Invoice) — ZUGFeRD/Factur-X
//   - UBL  (OASIS Universal Business Language) — XRechnung
// Namespaces werden gestrippt (removeNSPrefix), danach wird per Pfad gemappt.
//
// ponytail: liest die XML direkt. Die XML aus einem ZUGFeRD-PDF/A-3 zu extrahieren
// (eingebettete factur-x.xml) braucht einen PDF-Parser — Ceiling, Interface bleibt.

import { XMLParser } from "fast-xml-parser";

export interface ParsedInvoice {
  invoiceNumber?: string;
  issueDate?: string; // ISO YYYY-MM-DD
  total?: number;
  currency?: string;
  sellerName?: string;
  syntax?: "CII" | "UBL";
}

export function isEInvoice(mime: string, filename: string): boolean {
  const lower = filename.toLowerCase();
  return (
    mime === "application/xml" ||
    mime === "text/xml" ||
    lower.endsWith(".xml") ||
    lower.includes("xrechnung") ||
    lower.includes("zugferd") ||
    lower.includes("factur-x")
  );
}

const parser = new XMLParser({
  removeNSPrefix: true,
  ignoreDeclaration: true,
  parseTagValue: false, // Beträge als String lesen, selbst parsen (Nachkommastellen)
});

/** Liest verschachtelten Pfad; toleriert Arrays (nimmt erstes Element) und {#text}. */
function pick(node: unknown, path: string[]): unknown {
  let cur: unknown = node;
  for (const key of path) {
    if (cur == null) return undefined;
    if (Array.isArray(cur)) cur = cur[0];
    if (typeof cur !== "object" || cur === null) return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  if (Array.isArray(cur)) cur = cur[0];
  return cur;
}

/** Extrahiert den Textwert (fast-xml-parser legt Text mit Attributen unter #text ab). */
function text(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "object") {
    const t = (v as Record<string, unknown>)["#text"];
    return t == null ? undefined : String(t);
  }
  return String(v);
}

function num(v: unknown): number | undefined {
  const s = text(v);
  if (s == null) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/** CII-Datum "102"-Format ist YYYYMMDD → ISO. Sonst unverändert durchreichen. */
function isoDate(v: unknown): string | undefined {
  const s = text(v);
  if (!s) return undefined;
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(s.trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : s.trim();
}

function parseCII(doc: Record<string, unknown>): ParsedInvoice {
  const root = doc.CrossIndustryInvoice as Record<string, unknown>;
  const settlement = pick(root, ["SupplyChainTradeTransaction", "ApplicableHeaderTradeSettlement"]);
  const summation = pick(settlement, ["SpecifiedTradeSettlementHeaderMonetarySummation"]);
  return {
    syntax: "CII",
    invoiceNumber: text(pick(root, ["ExchangedDocument", "ID"])),
    issueDate: isoDate(pick(root, ["ExchangedDocument", "IssueDateTime", "DateTimeString"])),
    currency: text(pick(settlement, ["InvoiceCurrencyCode"])),
    total:
      num(pick(summation, ["GrandTotalAmount"])) ??
      num(pick(summation, ["DuePayableAmount"])),
    sellerName: text(
      pick(root, [
        "SupplyChainTradeTransaction",
        "ApplicableHeaderTradeAgreement",
        "SellerTradeParty",
        "Name",
      ]),
    ),
  };
}

function parseUBL(doc: Record<string, unknown>): ParsedInvoice {
  const root = doc.Invoice as Record<string, unknown>;
  return {
    syntax: "UBL",
    invoiceNumber: text(root.ID),
    issueDate: isoDate(root.IssueDate),
    currency: text(root.DocumentCurrencyCode),
    total: num(pick(root, ["LegalMonetaryTotal", "PayableAmount"])),
    sellerName: text(
      pick(root, ["AccountingSupplierParty", "Party", "PartyName", "Name"]),
    ),
  };
}

/**
 * Extrahiert Rechnungsdaten aus einer E-Rechnung (XML-Buffer/String).
 * Liefert null, wenn weder CII- noch UBL-Wurzel gefunden wird.
 */
export function parseEInvoice(buffer: Buffer | string, _mime?: string): ParsedInvoice | null {
  const xml = typeof buffer === "string" ? buffer : buffer.toString("utf-8");
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xml) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (doc.CrossIndustryInvoice) return parseCII(doc);
  if (doc.Invoice) return parseUBL(doc);
  return null;
}
