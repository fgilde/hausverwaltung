// Minimaler, abhängigkeitsfreier PDF-Generator: ein einseitiges A4-PDF mit
// Titel und Textzeilen (Helvetica, ASCII/WinAnsi). Genügt für Abrechnungen,
// Mahnungen und Demo-Dokumente — keine externe Lib nötig.
// ponytail: reicht für Text-Belege; für Grafiken/Mehrseitigkeit später eine
// echte PDF-Bibliothek einsetzen (Interface simplePdf bleibt).

export function simplePdf(title: string, lines: string[]): Buffer {
  const esc = (s: string) => s.replace(/([()\\])/g, "\\$1");
  const content =
    `BT /F1 20 Tf 60 780 Td (${esc(title)}) Tj ET ` +
    `BT /F1 11 Tf 60 740 Td 16 TL ` +
    lines.map((l) => `(${esc(l)}) Tj T*`).join(" ") +
    ` ET`;
  const objs: string[] = [];
  objs[1] = `<< /Type /Catalog /Pages 2 0 R >>`;
  objs[2] = `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`;
  objs[3] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`;
  objs[4] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`;
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
