import type { Currency } from "@/lib/currency";
import { money, date } from "@/lib/format";

export interface DunningInput {
  level: number;
  propertyName: string;
  unitLabel: string;
  renterName: string;
  tenantName: string; // Vermieter/Verwaltung (Mandant)
  tenantContact?: string[]; // Telefon/E-Mail der Verwaltung (#76)
  chargeTypeLabel: string;
  period: Date;
  dueDate: Date;
  open: number; // offener Betrag
  currency?: Currency;
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
      `Offener Posten (fällig ${date(input.dueDate)}):`,
      `${input.chargeTypeLabel} · ${date(input.period)}: ${money(input.open, "de", input.currency, true)}`,
      ...(input.fee > 0 ? [`Mahngebühr: ${money(input.fee, "de", input.currency, true)}`] : []),
      `Offener Gesamtbetrag: ${money(total, "de", input.currency, true)}`,
      "",
      "Wir bitten um Ausgleich innerhalb von 14 Tagen.",
      "",
      "Mit freundlichen Grüßen",
      input.tenantName,
      ...(input.tenantContact ?? []),
    ],
  };
}

/**
 * Brieftext einer Mahnung für den Postversand (#78): Anrede, offener Posten,
 * Zahlungsaufforderung, Gruß. Absätze durch Leerzeilen, Betreff = Titel.
 */
export function dunningLetterBody(input: DunningInput): string {
  const total = input.open + input.fee;
  const items = [
    `${input.chargeTypeLabel} · ${date(input.period)} (fällig ${date(input.dueDate)}): ${money(input.open, "de", input.currency, true)}`,
    ...(input.fee > 0 ? [`Mahngebühr: ${money(input.fee, "de", input.currency, true)}`] : []),
    `Offener Gesamtbetrag: ${money(total, "de", input.currency, true)}`,
  ];
  return [
    `Guten Tag ${input.renterName},`,
    `für ${input.propertyName} · ${input.unitLabel} ist bei uns folgender Betrag offen:`,
    items.join("\n"),
    "Wir bitten um Ausgleich innerhalb von 14 Tagen. Sollten Sie die Zahlung bereits veranlasst haben, betrachten Sie dieses Schreiben bitte als gegenstandslos.",
    `Mit freundlichen Grüßen\n${input.tenantName}`,
  ].join("\n\n");
}
