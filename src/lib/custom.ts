// Benutzerdefinierte Felder: Formular-Keys mit Präfix "cf_" einsammeln.

export function pickCustom(entries: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(entries)) {
    if (k.startsWith("cf_") && typeof v === "string" && v.trim() !== "") {
      out[k.slice(3)] = v.trim();
    }
  }
  return out;
}
