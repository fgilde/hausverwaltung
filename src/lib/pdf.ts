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

/** JPEG-Bild auf der Seite, z. B. eine Unterschrift (#55). `line` = Textzeile, über der es steht. */
export interface PdfImage {
  jpeg: Buffer;
  width: number; // Pixelmaße des JPEG
  height: number;
  line: number; // Index in `lines`; das Bild steht unten bündig über dieser Zeile
  drawWidth: number; // Breite auf der Seite in pt (Höhe proportional)
}

const LINE_TOP = 740; // y der ersten Textzeile
const LEADING = 16;

export function simplePdf(title: string, lines: string[], images: PdfImage[] = []): Buffer {
  // Erst PDF-Sonderzeichen escapen, dann nach WinAnsi kodieren.
  const enc = (s: string) => encodeWinAnsi(s.replace(/([()\\])/g, "\\$1"));
  const draw = images
    .map((img, i) => {
      const h = Math.round((img.drawWidth * img.height) / img.width);
      const y = LINE_TOP - LEADING * img.line + 12; // knapp über der Grundlinie der Zeile
      return `q ${img.drawWidth} 0 0 ${h} 60 ${y} cm /Im${i} Do Q`;
    })
    .join(" ");
  const content =
    `BT /F1 20 Tf 60 780 Td (${enc(title)}) Tj ET ` +
    `BT /F1 11 Tf 60 ${LINE_TOP} Td ${LEADING} TL ` +
    lines.map((l) => `(${enc(l)}) Tj T*`).join(" ") +
    ` ET` +
    (draw ? ` ${draw}` : "");

  // Objekte: 1 Katalog, 2 Seiten, 3 Seite, 4 Schrift, 5 Inhalt, 6+ Bilder
  const imgRefs = images.map((_, i) => `/Im${i} ${6 + i} 0 R`).join(" ");
  const objs: Buffer[] = [];
  const s = (x: string) => Buffer.from(x, "latin1");
  objs[1] = s(`<< /Type /Catalog /Pages 2 0 R >>`);
  objs[2] = s(`<< /Type /Pages /Kids [3 0 R] /Count 1 >>`);
  objs[3] = s(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >>` +
      (imgRefs ? ` /XObject << ${imgRefs} >>` : "") +
      ` >> /Contents 5 0 R >>`,
  );
  objs[4] = s(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`);
  objs[5] = s(`<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`);
  images.forEach((img, i) => {
    objs[6 + i] = Buffer.concat([
      s(
        `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB ` +
          `/BitsPerComponent 8 /Filter /DCTDecode /Length ${img.jpeg.length} >>\nstream\n`,
      ),
      img.jpeg,
      s(`\nendstream`),
    ]);
  });

  const count = objs.length - 1;
  const parts: Buffer[] = [s("%PDF-1.4\n")];
  let size = parts[0].length;
  const offsets: number[] = [];
  for (let i = 1; i <= count; i++) {
    offsets[i] = size;
    const obj = Buffer.concat([s(`${i} 0 obj\n`), objs[i], s(`\nendobj\n`)]);
    parts.push(obj);
    size += obj.length;
  }
  let tail = `xref\n0 ${count + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= count; i++) tail += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  tail += `trailer\n<< /Size ${count + 1} /Root 1 0 R >>\nstartxref\n${size}\n%%EOF`;
  parts.push(s(tail));
  return Buffer.concat(parts);
}

/** Pixelmaße aus einem JPEG lesen (SOF-Marker), ohne Bildbibliothek. */
export function jpegSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    // SOF0..SOF15 außer DHT (C4), JPG (C8), DAC (CC)
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
}
