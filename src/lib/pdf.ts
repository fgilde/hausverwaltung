// Minimaler, abhängigkeitsfreier PDF-Generator: ein einseitiges A4-PDF mit
// Titel und Textzeilen (Helvetica, WinAnsi/CP1252). Genügt für Abrechnungen,
// Mahnungen und Demo-Dokumente — keine externe Lib nötig.
// ponytail: reicht für Text-Belege; für Grafiken/Mehrseitigkeit später eine
// echte PDF-Bibliothek einsetzen (Interface simplePdf bleibt).

// CP1252-Sonderzeichen im Bereich 0x80–0x9F (u. a. €), die nicht mit Latin-1
// übereinstimmen. Der Rest von U+00A0–U+00FF (Umlaute, ß, §, ×) deckt sich mit
// Latin-1 und wird direkt übernommen.
const CP1252: Record<string, number> = {
  "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85,
  "†": 0x86, "‡": 0x87, "ˆ": 0x88, "‰": 0x89, "Š": 0x8a,
  "‹": 0x8b, "Œ": 0x8c, "Ž": 0x8e, "‘": 0x91, "’": 0x92,
  "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97,
  "˜": 0x98, "™": 0x99, "š": 0x9a, "›": 0x9b, "œ": 0x9c,
  "ž": 0x9e, "Ÿ": 0x9f,
};

/**
 * Wandelt einen String in eine WinAnsi/CP1252-Byte-Folge (als latin1-String, in
 * dem jedes Zeichen ein Byte ist). Nicht darstellbare Zeichen werden zu "?".
 */
export function encodeWinAnsi(s: string): string {
  let out = "";
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if (code <= 0xff) {
      out += String.fromCharCode(code); // Latin-1 == WinAnsi in diesem Bereich
    } else if (CP1252[ch] !== undefined) {
      out += String.fromCharCode(CP1252[ch]);
    } else {
      out += "?";
    }
  }
  return out;
}

export function simplePdf(title: string, lines: string[]): Buffer {
  // Erst PDF-Sonderzeichen escapen, dann nach WinAnsi kodieren.
  const enc = (s: string) => encodeWinAnsi(s.replace(/([()\\])/g, "\\$1"));
  const content =
    `BT /F1 20 Tf 60 780 Td (${enc(title)}) Tj ET ` +
    `BT /F1 11 Tf 60 740 Td 16 TL ` +
    lines.map((l) => `(${enc(l)}) Tj T*`).join(" ") +
    ` ET`;
  const objs: string[] = [];
  objs[1] = `<< /Type /Catalog /Pages 2 0 R >>`;
  objs[2] = `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`;
  objs[3] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`;
  objs[4] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`;
  objs[5] = `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`;
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let i = 1; i <= 5; i++) {
    offsets[i] = Buffer.byteLength(pdf, "latin1");
    pdf += `${i} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xrefStart = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 6\n0000000000 65535 f \n`;
  for (let i = 1; i <= 5; i++) pdf += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}
