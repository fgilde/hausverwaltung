// DATEV-Buchungsstapel-Export für den Steuerberater.
// ponytail: vereinfachtes semikolon-getrenntes Format, KEIN zertifiziertes
// EXTF (das braucht festen 2-Zeilen-Header + Feldkatalog). Deckt den
// üblichen "erst mal Zahlen rüberschieben"-Fall ab.

export interface DatevRow {
  amount: number;
  debitCredit: "S" | "H";
  account: string; // Konto
  contraAccount: string; // Gegenkonto
  date: string; // YYYY-MM-DD
  text: string;
}

export function toDatevCsv(rows: DatevRow[]): string {
  const header = ["Umsatz", "Soll/Haben-Kennzeichen", "Konto", "Gegenkonto", "Belegdatum", "Buchungstext"];
  const fmt = (r: DatevRow) =>
    [
      r.amount.toFixed(2).replace(".", ","),
      r.debitCredit,
      r.account,
      r.contraAccount,
      r.date.replace(/-/g, ""),
      `"${r.text.replace(/"/g, '""')}"`,
    ].join(";");
  return [header.join(";"), ...rows.map(fmt)].join("\r\n");
}
