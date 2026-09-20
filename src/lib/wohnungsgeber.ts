import { date } from "@/lib/format";

export interface WohnungsgeberInput {
  landlordName: string; // Wohnungsgeber (Vermieter/Verwaltung)
  landlordAddress: string; // Straße, PLZ Ort
  tenantNames: string[]; // einziehende Personen
  dwellingAddress: string; // Anschrift der Wohnung
  moveInDate: Date | null; // Einzugsdatum
}

/**
 * Textbausteine einer Wohnungsgeberbestätigung nach § 19 BMG. Reine Funktion,
 * damit der Pflichtinhalt testbar ist; das PDF baut daraus simplePdf.
 */
export function wohnungsgeberDocument(input: WohnungsgeberInput): { title: string; lines: string[] } {
  const tenants = input.tenantNames.filter(Boolean);
  return {
    title: "Wohnungsgeberbestätigung",
    lines: [
      "gemäß § 19 Bundesmeldegesetz (BMG)",
      "",
      "Wohnungsgeber:",
      input.landlordName,
      input.landlordAddress,
      "",
      "Anschrift der Wohnung:",
      input.dwellingAddress,
      "",
      `Art der Meldung: Einzug`,
      `Einzugsdatum: ${input.moveInDate ? date(input.moveInDate) : "—"}`,
      "",
      "Meldepflichtige Person(en):",
      ...(tenants.length ? tenants : ["—"]),
      "",
      "Hiermit wird der Einzug der oben genannten Person(en) in die",
      "genannte Wohnung bestätigt.",
      "",
      "____________________________",
      "Ort, Datum, Unterschrift Wohnungsgeber",
    ],
  };
}
