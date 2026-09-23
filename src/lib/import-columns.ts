// Spaltenzuordnung für CSV-Importe. Header werden case-insensitiv und mit
// deutschen wie englischen Aliassen erkannt (#33), damit ein CSV mit den in der
// UI sichtbaren deutschen Spaltennamen ebenso funktioniert wie eines mit den
// englischen Feldnamen.

export type ColSpec = Record<string, string[]>; // Feld -> erlaubte Alias-Header

/** Liefert je Feld den Spaltenindex im Header (-1 wenn nicht gefunden). */
export function mapColumns(header: string[], spec: ColSpec): Record<string, number> {
  const h = header.map((x) => x.trim().toLowerCase());
  const out: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(spec)) {
    out[field] = h.findIndex((x) => aliases.includes(x));
  }
  return out;
}

export const PERSON_COLS: ColSpec = {
  firstName: ["firstname", "vorname"],
  lastName: ["lastname", "nachname", "name"],
  email: ["email", "e-mail", "mail"],
  phone: ["phone", "telefon", "tel", "telefonnummer"],
  type: ["type", "typ", "art", "rolle"],
  note: ["note", "notiz", "bemerkung", "anmerkung"],
};

export const PROPERTY_COLS: ColSpec = {
  name: ["name", "objekt", "bezeichnung"],
  street: ["street", "straße", "strasse", "str"],
  zip: ["zip", "plz", "postleitzahl"],
  city: ["city", "ort", "stadt"],
  type: ["type", "typ", "art"],
  management: ["management", "verwaltung", "verwaltungsart"],
};

export const UNIT_COLS: ColSpec = {
  property: ["property", "objekt", "immobilie"],
  building: ["building", "gebäude", "gebaeude", "haus"],
  label: ["label", "bezeichnung", "name", "nummer", "nr", "wohnung"],
  type: ["type", "typ", "art"],
  area: ["area", "fläche", "flaeche", "größe", "groesse", "m2", "qm", "wohnfläche", "wohnflaeche"],
  rooms: ["rooms", "zimmer", "räume", "raeume", "zimmeranzahl"],
  mea: ["mea", "miteigentumsanteil", "miteigentumsanteile", "anteil"],
};

// Wert-Aliasse für Enum-Spalten (deutsche Eingaben auf die internen Codes).
export function normalizeEnum(value: string | undefined, map: Record<string, string>, fallback: string): string {
  if (!value) return fallback;
  const v = value.trim().toLowerCase();
  return map[v] ?? fallback;
}

export const PROPERTY_TYPE_MAP: Record<string, string> = {
  wohnen: "WOHNEN", wohnung: "WOHNEN", residential: "WOHNEN",
  gewerbe: "GEWERBE", commercial: "GEWERBE",
  gemischt: "GEMISCHT", mixed: "GEMISCHT",
};
export const MANAGEMENT_MAP: Record<string, string> = {
  miet: "MIET", miete: "MIET", rental: "MIET", mietverwaltung: "MIET",
  weg: "WEG", weg_verwaltung: "WEG", hoa: "WEG",
};
export const UNIT_TYPE_MAP: Record<string, string> = {
  wohnung: "WOHNUNG", flat: "WOHNUNG", apartment: "WOHNUNG",
  gewerbe: "GEWERBE", commercial: "GEWERBE",
  stellplatz: "STELLPLATZ", parking: "STELLPLATZ", garage: "STELLPLATZ",
  keller: "KELLER", cellar: "KELLER",
  sonstiges: "SONSTIGES", other: "SONSTIGES",
};
