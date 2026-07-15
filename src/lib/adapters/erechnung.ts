// E-Rechnungs-Adapter (XRechnung / ZUGFeRD). Pflicht-Empfang seit 01/2025.
//
// ponytail: Stub-Implementierung. Erkennt E-Rechnungen anhand von MIME/Endung.
// Echtes Parsing (CII/UBL-XML aus ZUGFeRD-PDF/A-3 extrahieren, Felder mappen)
// folgt mit einer XML-Bibliothek — Interface bleibt gleich.

export interface ParsedInvoice {
  invoiceNumber?: string;
  issueDate?: string;
  total?: number;
  currency?: string;
  sellerName?: string;
}

export function isEInvoice(mime: string, filename: string): boolean {
  const lower = filename.toLowerCase();
  return (
    mime === "application/xml" ||
    mime === "text/xml" ||
    lower.endsWith(".xml") ||
    lower.includes("xrechnung") ||
    lower.includes("zugferd")
  );
}

/**
 * Extrahiert Rechnungsdaten aus einer E-Rechnung.
 * Stub: liefert null (kein Parsing implementiert).
 */
export function parseEInvoice(_buffer: Buffer, _mime: string): ParsedInvoice | null {
  return null;
}
