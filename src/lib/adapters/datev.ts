// DATEV-Buchungsstapel-Export im EXTF-Format (Format 700, Kategorie 21,
// Formatversion 13). Zwei Kopfzeilen (Metadaten + Feldnamen) + Buchungssätze.
// Feldkatalog: die führenden Spalten des Buchungsstapels; nicht belegte Felder
// bleiben leer. Beträge mit Komma-Dezimaltrennung, Belegdatum als TTMM.
// ponytail: deckt den Standard-Buchungsstapel ab (Umsatz/SH/Konto/Gegenkonto/
// Datum/Text); BU-Schlüssel/Kost/Skonto bleiben leer. Ausgabe als CP1252.

export interface DatevRow {
  amount: number; // immer positiv; Vorzeichen über Soll/Haben
  debitCredit: "S" | "H";
  account: string;
  contraAccount: string;
  date: string; // YYYY-MM-DD
  text: string;
  invoiceField?: string; // Belegfeld 1 (z. B. Rechnungs-/Referenznr.)
}

export interface DatevMeta {
  beraterNr?: string;
  mandantNr?: string;
  wjBeginn: Date; // Wirtschaftsjahresbeginn
  datumVon: Date;
  datumBis: Date;
  bezeichnung?: string;
  now: Date; // Erstellzeitpunkt (aus dem Aufrufer, Route)
  sachkontenlaenge?: number; // Standard 4
}

// Offizielle Feldnamen der führenden Buchungsstapel-Spalten (Reihenfolge fix).
const COLUMNS = [
  "Umsatz (ohne Soll/Haben-Kz)",
  "Soll/Haben-Kennzeichen",
  "WKZ Umsatz",
  "Kurs",
  "Basis-Umsatz",
  "WKZ Basis-Umsatz",
  "Konto",
  "Gegenkonto (ohne BU-Schlüssel)",
  "BU-Schlüssel",
  "Belegdatum",
  "Belegfeld 1",
  "Belegfeld 2",
  "Skonto",
  "Buchungstext",
];

const q = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
const ymdhms = (d: Date) => {
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return (
    d.getUTCFullYear().toString() +
    p(d.getUTCMonth() + 1) +
    p(d.getUTCDate()) +
    p(d.getUTCHours()) +
    p(d.getUTCMinutes()) +
    p(d.getUTCSeconds()) +
    p(d.getUTCMilliseconds(), 3)
  );
};
const ttmm = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}${m}`; // TTMM (Jahr aus dem Wirtschaftsjahr)
};

export function toDatevExtf(rows: DatevRow[], meta: DatevMeta): string {
  // Kopfzeile 1: EXTF-Metadaten (31 Felder; nur belegte gesetzt).
  const header: (string | number)[] = new Array(31).fill("");
  header[0] = q("EXTF");
  header[1] = 700;
  header[2] = 21;
  header[3] = q("Buchungsstapel");
  header[4] = 13;
  header[5] = ymdhms(meta.now);
  header[10] = meta.beraterNr ?? "";
  header[11] = meta.mandantNr ?? "";
  header[12] = ymd(meta.wjBeginn);
  header[13] = meta.sachkontenlaenge ?? 4;
  header[14] = ymd(meta.datumVon);
  header[15] = ymd(meta.datumBis);
  header[16] = q(meta.bezeichnung ?? "Buchungsstapel");
  header[18] = 1; // Buchungstyp (1 = Finanzbuchführung)
  header[19] = 0; // Rechnungslegungszweck
  header[20] = 0; // Festschreibung (0 = nein)
  header[21] = q("EUR");

  const headerLine = header.join(";");
  const columnLine = COLUMNS.map(q).join(";");

  const dataLines = rows.map((r) => {
    const cells = new Array(COLUMNS.length).fill("");
    cells[0] = Math.abs(r.amount).toFixed(2).replace(".", ",");
    cells[1] = r.debitCredit;
    cells[2] = q("EUR");
    cells[6] = r.account;
    cells[7] = r.contraAccount;
    cells[9] = ttmm(r.date);
    cells[10] = r.invoiceField ? q(r.invoiceField) : "";
    cells[13] = q(r.text.slice(0, 60));
    return cells.join(";");
  });

  return [headerLine, columnLine, ...dataLines].join("\r\n") + "\r\n";
}
