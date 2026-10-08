import { XMLParser } from "fast-xml-parser";

// camt.053-Kontoauszug-Import (MT940 ist zum 11/2025 ausgelaufen).
// ponytail: liest die gängigen Ntry-Felder. Für exotische Bank-Varianten
// (mehrere TxDtls je Ntry, Batch-Buchungen) ggf. erweitern.

export interface BankEntry {
  date: string; // YYYY-MM-DD
  amount: number; // immer positiv
  direction: "EINGANG" | "AUSGANG";
  reference?: string;
  counterparty?: string; // Zahler (Eingang) bzw. Empfänger (Ausgang), #60
  counterpartyIban?: string;
}

function toArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function num(amt: unknown): number {
  if (amt && typeof amt === "object" && "#text" in amt) return Number((amt as Record<string, unknown>)["#text"]);
  return Number(amt);
}

export function parseCamt053(xml: string): BankEntry[] {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const obj = parser.parse(xml);
  const stmts = toArray(obj?.Document?.BkToCstmrStmt?.Stmt);
  const out: BankEntry[] = [];

  for (const stmt of stmts) {
    for (const ntry of toArray(stmt?.Ntry)) {
      const amount = Math.abs(num(ntry?.Amt));
      const direction = ntry?.CdtDbtInd === "DBIT" ? "AUSGANG" : "EINGANG";
      const date =
        ntry?.BookgDt?.Dt ?? ntry?.ValDt?.Dt ?? new Date(0).toISOString().slice(0, 10);
      const tx = toArray(ntry?.NtryDtls?.TxDtls)[0];
      const reference = toArray(tx?.RmtInf?.Ustrd).join(" ") || undefined;
      // Gegenseite: Dbtr bei Eingang, Cdtr bei Ausgang; Name ab camt.053.001.08 unter Pty
      const side = direction === "EINGANG" ? "Dbtr" : "Cdtr";
      const party = tx?.RltdPties?.[side];
      const name = party?.Nm ?? party?.Pty?.Nm;
      const iban = tx?.RltdPties?.[`${side}Acct`]?.Id?.IBAN;
      out.push({
        date: String(date).slice(0, 10), amount, direction, reference,
        ...(name ? { counterparty: String(name).trim() } : {}),
        ...(iban ? { counterpartyIban: String(iban).replace(/\s/g, "") } : {}),
      });
    }
  }
  return out;
}
