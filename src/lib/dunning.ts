import { money, date } from "@/lib/format";

export interface DunningInput {
  level: number;
  propertyName: string;
  unitLabel: string;
  renterName: string;
  tenantName: string; // Vermieter/Verwaltung (Mandant)
  chargeTypeLabel: string;
  period: Date;
  dueDate: Date;
  open: number; // offener Betrag
  fee: number; // Mahngebühr
}

/**
 * Titel + Textzeilen einer Mahnung / Zahlungserinnerung. Reine Funktion, damit
 * der Inhalt testbar ist; PDF-Route und E-Mail-Entwurf bauen daraus simplePdf.
 * Ab Stufe 2 „N. Mahnung", Stufe 1 „Zahlungserinnerung".
 */
export function dunningDocument(input: DunningInput): { title: string; lines: string[] } {
  const total = input.open + input.fee;
  const title = input.level >= 2 ? `${input.level}. Mahnung` : "Zahlungserinnerung";
  return {
    title,
    lines: [
      input.renterName,
      "",
      `${input.propertyName} · ${input.unitLabel}`,
      "",
      `Offener Posten (faellig ${date(input.dueDate)}):`,
      `${input.chargeTypeLabel} · ${date(input.period)}: ${money(input.open)}`,
      ...(input.fee > 0 ? [`Mahngebuehr: ${money(input.fee)}`] : []),
      `Offener Gesamtbetrag: ${money(total)}`,
      "",
      "Wir bitten um Ausgleich innerhalb von 14 Tagen.",
      "",
      "Mit freundlichen Gruessen",
      input.tenantName,
    ],
  };
}
