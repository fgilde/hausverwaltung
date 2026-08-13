// CSV-Erzeugung (Semikolon-getrennt, für deutsches Excel) mit UTF-8-BOM.
function cell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(cell).join(";"), ...rows.map((r) => r.map(cell).join(";"))];
  return "﻿" + lines.join("\r\n");
}

/**
 * CSV parsen (Semikolon ODER Komma als Trenner, Anführungszeichen, BOM).
 * Liefert Zeilen als String-Arrays; leere Zeilen werden verworfen.
 */
export function parseCsv(text: string): string[][] {
  const t = text.replace(/^﻿/, "");
  // Trenner aus der ersten Zeile bestimmen (deutsches Excel = ;).
  const firstLine = t.slice(0, t.search(/\r?\n/) === -1 ? t.length : t.search(/\r?\n/));
  const delim = firstLine.split(";").length > firstLine.split(",").length ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inQuotes) {
      if (c === '"') {
        if (t[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === delim) { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c === "\r") { /* ignore */ }
    else field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== "")).map((r) => r.map((c) => c.trim()));
}

export function csvResponse(filename: string, csv: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
