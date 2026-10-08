import "server-only";
import path from "node:path";
import PDFDocument from "pdfkit";

// Geschäftsbrief nach DIN 5008 (Form B) als PDF/A-1b (#58). PDF/A verlangt die
// Deutsche Post (E-POSTBUSINESS); dafür ist die Schrift eingebettet (Liberation
// Sans, metrisch gleich Arial). Das Anschriftfeld liegt so, dass es sowohl in
// der Pingen-Adresszone (x 22 / y 60, 85,5 × 25,5 mm) als auch im Empfängerbereich
// der Post-Schablone (ab y 69,2 mm) liegt: 4 Zeilen à 9 pt ab y 70 mm.

const FONTS = path.join(process.cwd(), "src/assets/fonts");
const mm = (v: number) => v * 2.834645669;

export type LetterInput = {
  sender: { name: string; lines: string[] }; // Absender (Verwaltung), Anschrift zeilenweise
  recipient: string[]; // Anschriftzeilen, max. 4 (Name, Straße, PLZ Ort, Land)
  place: string; // Ort für die Datumszeile
  date: string; // bereits formatiert
  subject: string;
  body: string; // Fließtext, Absätze durch Leerzeilen
};

export const MAX_RECIPIENT_LINES = 4; // mehr passt nicht in beide Fensterzonen

export function letterPdf(l: LetterInput): Promise<Buffer> {
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

  // Text; Seitenumbrüche macht pdfkit selbst (Folgeseiten ab dem oberen Rand)
  doc.font("R").fontSize(11).moveDown(1.2);
  const paras = l.body.replace(/\r\n/g, "\n").split(/\n{2,}/);
  paras.forEach((p, i) => {
    doc.text(p, mm(25), doc.y, { width: mm(165), lineGap: 2 });
    if (i < paras.length - 1) doc.moveDown(0.8);
  });

  // Seitenzahlen bei mehrseitigen Briefen
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
}
