import "server-only";
import path from "node:path";
import PDFDocument from "pdfkit";
import { letterBlocks } from "@/lib/letter-html";

// Geschäftsbrief nach DIN 5008 (Form B) als PDF/A-1b (#58). PDF/A verlangt die
// Deutsche Post (E-POSTBUSINESS); dafür ist die Schrift eingebettet (Liberation
// Sans, metrisch gleich Arial). Das Anschriftfeld liegt so, dass es sowohl in
// der Pingen-Adresszone (x 22 / y 60, 85,5 × 25,5 mm) als auch im Empfängerbereich
// der Post-Schablone (ab y 69,2 mm) liegt: 4 Zeilen à 9 pt ab y 70 mm.

const FONTS = path.join(process.cwd(), "src/assets/fonts");
export const mm = (v: number) => v * 2.834645669;

export type LetterInput = {
  sender: { name: string; lines: string[] }; // Absender (Verwaltung), Anschrift zeilenweise
  recipient: string[]; // Anschriftzeilen, max. 4 (Name, Straße, PLZ Ort, Land)
  place: string; // Ort für die Datumszeile
  date: string; // bereits formatiert
  subject: string;
  body: string; // Editor-HTML (#67) oder Klartext mit Leerzeilen als Absatzgrenzen
};

export const MAX_RECIPIENT_LINES = 4; // mehr passt nicht in beide Fensterzonen

/**
 * Neues A4-Dokument mit Briefkopf, Anschriftfeld, Ort/Datum und Betreff; der Text beginnt
 * danach an doc.y. Geteilt von Brief (#58) und Einzelabrechnung (#94). `finish` setzt
 * bei mehreren Seiten „Seite x von y“ und liefert das PDF.
 */
export function openLetter(l: Omit<LetterInput, "body">) {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: mm(20), bottom: mm(25), left: mm(25), right: mm(20) },
    pdfVersion: "1.4",
    subset: "PDF/A-1b",
    font: path.join(FONTS, "LiberationSans-Regular.ttf"),
    info: { Title: l.subject, Author: l.sender.name, Creator: "HaVeWa" },
    lang: "de-DE",
    bufferPages: true, // für „Seite x von y“
  });
  doc.registerFont("R", path.join(FONTS, "LiberationSans-Regular.ttf"));
  doc.registerFont("B", path.join(FONTS, "LiberationSans-Bold.ttf"));
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  // Briefkopf rechts (Informationsblock): Absender
  doc.font("B").fontSize(10).text(l.sender.name, mm(125), mm(32), { width: mm(65) });
  doc.font("R").fontSize(9);
  for (const line of l.sender.lines) doc.text(line, { width: mm(65) });

  // Anschriftfeld (Fensterumschlag links): nur die Anschrift, keine Leerzeilen
  doc.font("R").fontSize(9);
  const rec = l.recipient.map((s) => s.trim()).filter(Boolean).slice(0, MAX_RECIPIENT_LINES);
  rec.forEach((line, i) => doc.text(line, mm(25), mm(70) + i * mm(3.6), { width: mm(80), lineBreak: false }));

  // Ort, Datum rechtsbündig, Betreff fett
  doc.fontSize(10).text([l.place, l.date].filter(Boolean).join(", "), mm(25), mm(98), {
    width: mm(165),
    align: "right",
  });
  doc.font("B").fontSize(11).text(l.subject, mm(25), mm(106), { width: mm(165) });

  const finish = () => {
    // Seitenzahlen bei mehrseitigen Dokumenten
    const { start, count } = doc.bufferedPageRange();
    if (count > 1) {
      for (let i = start; i < start + count; i++) {
        doc.switchToPage(i);
        doc.page.margins.bottom = 0; // sonst legt pdfkit beim Schreiben im Rand eine neue Seite an
        doc.font("R").fontSize(8).text(`Seite ${i + 1} von ${count}`, mm(25), mm(285), { width: mm(165), align: "right" });
      }
    }
    doc.end();
    return done;
  };
  return { doc, finish };
}

export function letterPdf(l: LetterInput): Promise<Buffer> {
  const { doc, finish } = openLetter(l);

  // Text; Seitenumbrüche macht pdfkit selbst (Folgeseiten ab dem oberen Rand)
  doc.font("R").fontSize(11).moveDown(1.2);
  // Formatierter Text (#67): fett, kursiv (schräggestellt), unterstrichen, Listen, Zitate
  const blocks = letterBlocks(l.body);
  blocks.forEach((b, i) => {
    const x = mm(25 + b.indent * 6);
    const width = mm(165 - b.indent * 6);
    const y = doc.y;
    if (b.marker) doc.font("R").text(b.marker, x - mm(5), y, { width: mm(5) });
    // Zeilenumbruch (<br>): pdfkit setzt "\n" in fortgesetztem Text als Leerzeichen,
    // daher die Zeile dort beenden und die nächste am Blockanfang (x) weiterschreiben
    let lineStart = true;
    b.runs.forEach((r, j) => {
      if (r.text === "\n") {
        if (!lineStart) doc.text("", { continued: false });
        else if (j > 0) doc.text(" ", x, doc.y, { width }); // Leerzeile
        lineStart = true;
        return;
      }
      const o = { width, lineGap: 2, continued: j < b.runs.length - 1 && b.runs[j + 1].text !== "\n", underline: !!r.underline, oblique: r.italic ? 12 : false };
      doc.font(r.bold ? "B" : "R");
      if (lineStart) doc.text(r.text, x, j === 0 ? y : doc.y, o);
      else doc.text(r.text, o);
      lineStart = false;
    });
    const next = blocks[i + 1];
    if (next) doc.moveDown(b.marker && next.marker ? 0.3 : 0.8);
  });

  return finish();
}
