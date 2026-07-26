// Vorlagen-/Serienbrief-Rendering: {{schluessel}} durch Kontextwerte ersetzen.

/**
 * Ersetzt {{key}} durch context[key]. Unbekannte Platzhalter bleiben stehen
 * (damit fehlende Daten sichtbar sind, nicht still verschwinden).
 * Whitespace im Platzhalter wird toleriert: {{ key }}.
 */
export function renderTemplate(body: string, context: Record<string, string>): string {
  return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key: string) => {
    const val = context[key];
    return val === undefined || val === null ? match : String(val);
  });
}

/** Alle Platzhalter-Schlüssel aus einem Text extrahieren (dedupliziert). */
export function extractPlaceholders(body: string): string[] {
  const set = new Set<string>();
  for (const m of body.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)) set.add(m[1]);
  return [...set];
}
