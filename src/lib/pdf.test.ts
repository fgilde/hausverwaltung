import { describe, it, expect } from "vitest";
import { encodeWinAnsi, simplePdf } from "./pdf";

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
