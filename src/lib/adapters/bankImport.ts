import { XMLParser, XMLValidator } from "fast-xml-parser";

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
  accountIban?: string;
  bankReference?: string;
  statementId?: string;
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
  if (XMLValidator.validate(xml) !== true) throw new Error("Ungültiges XML");
  const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false, removeNSPrefix: true });
  const obj = parser.parse(xml);
  const stmts = toArray(obj?.Document?.BkToCstmrStmt?.Stmt);
  const out: BankEntry[] = [];

  for (const stmt of stmts) {
    const accountIban = stmt?.Acct?.Id?.IBAN?.replace(/\s/g, "").toUpperCase();
    const statementId = stmt?.Id;
    for (const ntry of toArray(stmt?.Ntry)) {
      const amount = Math.abs(num(ntry?.Amt));
      if (!Number.isFinite(amount) || amount <= 0 || (ntry?.CdtDbtInd !== "DBIT" && ntry?.CdtDbtInd !== "CRDT")) {
        throw new Error("Ungültiger Betrag oder Buchungsrichtung");
      }
      const direction = ntry?.CdtDbtInd === "DBIT" ? "AUSGANG" : "EINGANG";
      const date =
        ntry?.BookgDt?.Dt ?? ntry?.BookgDt?.DtTm ?? ntry?.ValDt?.Dt ?? ntry?.ValDt?.DtTm;
      const day = typeof date === "string" ? date.slice(0, 10) : "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(day)) || new Date(day).toISOString().slice(0, 10) !== day) {
        throw new Error("Ungültiges Buchungsdatum");
      }
      const details = toArray(ntry?.NtryDtls).flatMap((detail) => toArray(detail?.TxDtls));
      const tx = details.length === 1 ? details[0] : undefined;
      const bankReference = [ntry?.AcctSvcrRef, tx?.Refs?.AcctSvcrRef]
        .find((ref) => typeof ref === "string" && ref && !/^(NONREF|NOTPROVIDED)$/i.test(ref));
      const reference = toArray(tx?.RmtInf?.Ustrd).join(" ") || ntry?.AddtlNtryInf || undefined;
      // Gegenseite: Dbtr bei Eingang, Cdtr bei Ausgang; Name ab camt.053.001.08 unter Pty
      const side = direction === "EINGANG" ? "Dbtr" : "Cdtr";
      const party = tx?.RltdPties?.[side];
      const name = party?.Nm ?? party?.Pty?.Nm;
      const iban = tx?.RltdPties?.[`${side}Acct`]?.Id?.IBAN;
      out.push({
        date: day, amount, direction, reference,
        ...(name ? { counterparty: String(name).trim() } : {}),
        ...(iban ? { counterpartyIban: String(iban).replace(/\s/g, "") } : {}),
        ...(accountIban ? { accountIban } : {}),
        ...(bankReference ? { bankReference } : {}),
        ...(statementId ? { statementId } : {}),
      });
    }
  }
  return out;
}
