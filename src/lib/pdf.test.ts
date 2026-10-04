import { describe, it, expect } from "vitest";
import { encodeWinAnsi, simplePdf, jpegSize } from "./pdf";

describe("encodeWinAnsi (#36 Umlaute/Sonderzeichen)", () => {
  it("Euro-Zeichen -> 0x80", () => {
    expect(encodeWinAnsi("€")).toBe("\x80");
  });
  it("Umlaute/ß bleiben Latin-1", () => {
    expect(encodeWinAnsi("äöüÄÖÜß")).toBe("\xe4\xf6\xfc\xc4\xd6\xdc\xdf");
  });
  it("§ und geschütztes Leerzeichen bleiben erhalten", () => {
    expect(encodeWinAnsi("§ ")).toBe("\xa7\xa0");
  });
  it("nicht darstellbares Zeichen -> ?", () => {
    expect(encodeWinAnsi("😀")).toBe("?");
  });
});

describe("simplePdf", () => {
  it("kodiert € als WinAnsi-Byte 0x80 und deklariert WinAnsiEncoding", () => {
    const pdf = simplePdf("Test", ["Betrag: 1.234,56 €", "Grüße"]);
    const latin1 = pdf.toString("latin1");
    expect(latin1).toContain("/WinAnsiEncoding");
    expect(latin1).toContain("\x80"); // €
    expect(latin1).toContain("\xfc"); // ü
    expect(latin1.startsWith("%PDF-1.4")).toBe(true);
  });
});

// Kleinstes gültiges JPEG-Gerüst: SOI, SOF0 (16×8 px), EOI
const tinyJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x08, 0x00, 0x10, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1, 0xff, 0xd9]);

describe("simplePdf mit Unterschrift (#55)", () => {
  it("liest die Bildmaße aus dem JPEG", () => {
    expect(jpegSize(tinyJpeg)).toEqual({ width: 16, height: 8 });
    expect(jpegSize(Buffer.from("kein jpeg"))).toBeNull();
  });
  it("bettet das JPEG als Bild ein, Querverweise stimmen", () => {
    const pdf = simplePdf("Test", ["a", "b", "c"], [{ jpeg: tinyJpeg, width: 16, height: 8, line: 2, drawWidth: 160 }]);
    const l = pdf.toString("latin1");
    expect(l).toContain("/Subtype /Image /Width 16 /Height 8");
    expect(l).toContain("/Filter /DCTDecode");
    expect(l).toContain("/XObject << /Im0 6 0 R >>");
    expect(l).toContain("160 0 0 80 60 720 cm /Im0 Do");
    // xref-Offsets zeigen auf die Objekte
    const xrefAt = l.indexOf("\nxref\n") + 1; // nicht das „xref“ in „startxref“
    const xref = l.slice(xrefAt);
    const offs = [...xref.matchAll(/^(\d{10}) 00000 n/gm)].map((m) => Number(m[1]));
    offs.forEach((o, i) => expect(l.startsWith(`${i + 1} 0 obj`, o)).toBe(true));
    expect(Number(l.match(/startxref\n(\d+)/)![1])).toBe(xrefAt);
  });
});
