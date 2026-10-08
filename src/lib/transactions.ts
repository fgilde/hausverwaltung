import type { Prisma } from "@prisma/client";

export interface Txn {
  direction: "EINGANG" | "AUSGANG";
  amount: number;
}

/** Summiert Kontobewegungen: Eingänge, Ausgänge, Saldo und Anzahl. */
export function summarizeTransactions(txns: Txn[]): {
  inTotal: number;
  outTotal: number;
  net: number;
  count: number;
} {
  let inTotal = 0;
  let outTotal = 0;
  for (const t of txns) {
    if (t.direction === "EINGANG") inTotal += t.amount;
    else outTotal += t.amount;
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return { inTotal: round(inTotal), outTotal: round(outTotal), net: round(inTotal - outTotal), count: txns.length };
}

export type TxnFilter = { acc?: string; from?: string; to?: string; min?: string; max?: string; dir?: string; q?: string };

/** "1.234,56" / "12,5" / "12.5" → Zahl; leer oder ungültig → undefined. */
export function parseAmount(v: string | undefined): number | undefined {
  const s = (v ?? "").trim().replace(/\s|€/g, "");
  if (!s) return undefined;
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) ? n : undefined;
}

const day = (v: string | undefined) => (/^\d{4}-\d{2}-\d{2}$/.test(v ?? "") ? new Date(`${v}T00:00:00Z`) : undefined);

/** Such-/Filterkriterien der Transaktionsansicht (#62) als Prisma-where (ohne Mandant). */
export function txnWhere(f: TxnFilter): Prisma.PaymentWhereInput {
  const from = day(f.from);
  const to = day(f.to);
  if (to) to.setUTCDate(to.getUTCDate() + 1); // „bis“ inklusive
  const min = parseAmount(f.min);
  const max = parseAmount(f.max);
  const q = f.q?.trim();
  const contains = (field: string): Prisma.PaymentWhereInput => ({ [field]: { contains: q, mode: "insensitive" } });
  return {
    ...(f.acc ? { accountId: f.acc } : {}),
    ...(f.dir === "EINGANG" || f.dir === "AUSGANG" ? { direction: f.dir } : {}),
    ...(from || to ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}),
    ...(min !== undefined || max !== undefined
      ? { amount: { ...(min !== undefined ? { gte: min } : {}), ...(max !== undefined ? { lte: max } : {}) } }
      : {}),
    ...(q ? { OR: ["counterparty", "counterpartyIban", "reference", "note"].map(contains) } : {}),
  };
}
