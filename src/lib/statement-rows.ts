import type { StatementItem } from "@/lib/allocation/statement";

// Zeilen der Einzelabrechnung (#94): je Kostenposition Gesamtkosten, Schlüssel, Verteilung
// (Anteil der Einheit am Verteilerkreis), Zeitanteil und Betrag. Rein, damit testbar;
// das PDF (server/statement-pdf.ts) setzt nur noch die Texte.

export type StatementRow = {
  label: string;
  total: number;
  key: string;
  basis: string;
  share: string;
  amount: number;
};

const num = (v: number, digits = 2) =>
  new Intl.NumberFormat("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);

const KEY: Record<string, string> = {
  AREA: "Wohnfläche",
  UNITS: "Einheiten",
  PERSONS: "Personen",
  CONSUMPTION: "Verbrauch (Zähler)",
  MEA: "Miteigentumsanteile",
  CUSTOM: "Festanteil",
};

function basisText(i: StatementItem): string {
  switch (i.method) {
    case "AREA":
      return `${num(i.unitBasis)} m² von ${num(i.totalBasis)} m²`;
    case "UNITS":
      return `${num(i.unitBasis, 0)} von ${num(i.totalBasis, 0)} Einheiten`;
    case "PERSONS":
      // mit Zeitscheiben: Personen × Anteil der Tage (#90)
      return i.apportion === "persons"
        ? `${num(i.unitBasis)} von ${num(i.totalBasis)} Personenjahren`
        : `${num(i.unitBasis, 0)} von ${num(i.totalBasis, 0)} Personen`;
    case "CONSUMPTION":
      return `${num(i.unitBasis)} von ${num(i.totalBasis)}`;
    case "MEA":
      return `${num(i.unitBasis)} von ${num(i.totalBasis)} MEA`;
    default:
      return "";
  }
}

function shareText(i: StatementItem, timeShare: string): string {
  if (i.apportion === "persons") return "tagesgenau";
  if (i.apportion === "months") return timeShare;
  return `${num(i.leaseFactor * 100, 0)} %`;
}

export function statementRows(
  items: StatementItem[],
  costs: { id: string; type: string; note: string | null }[],
  costLabel: (type: string) => string,
  /** Zeitanteil als Text, z. B. "7/12" oder "139/365 Tage" (#108) */
  timeShare: string,
): StatementRow[] {
  const byId = new Map(costs.map((c) => [c.id, c]));
  return items.map((i) => {
    const c = byId.get(i.costId);
    const name = c ? `${costLabel(c.type)}${c.note ? ` (${c.note})` : ""}` : i.costId;
    const part = i.part === "base" ? " – Grundkosten" : i.part === "consumption" ? " – Verbrauchskosten" : "";
    return {
      label: name + part,
      total: i.total,
      key: KEY[i.method] ?? i.method,
      basis: basisText(i),
      share: shareText(i, timeShare),
      amount: i.amount,
    };
  });
}
