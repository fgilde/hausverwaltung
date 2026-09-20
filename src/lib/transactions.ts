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
