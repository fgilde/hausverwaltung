import { describe, expect, it } from "vitest";
import { letterBlocks } from "./letter-html";

describe("letterBlocks (#67)", () => {
  it("Klartext: Absätze durch Leerzeilen, Zeilenumbruch bleibt", () => {
    expect(letterBlocks("Hallo\nWelt\n\nZweiter")).toEqual([
      { indent: 0, runs: [{ text: "Hallo" }, { text: "\n" }, { text: "Welt" }] },
      { indent: 0, runs: [{ text: "Zweiter" }] },
    ]);
  });

  it("fett, kursiv, unterstrichen und Entities", () => {
    expect(letterBlocks("<p>A <strong>fett <em>beides</em></strong> <u>u</u> &amp;</p>")).toEqual([
      {
        indent: 0,
        runs: [
          { text: "A " },
          { text: "fett ", bold: true },
          { text: "beides", bold: true, italic: true },
          { text: " " },
          { text: "u", underline: true },
          { text: " &" },
        ],
      },
    ]);
  });

  it("Listen mit Marker und Einrückung (Tiptap packt Einträge in <p>)", () => {
    const b = letterBlocks("<ol><li><p>eins</p></li><li><p>zwei</p></li></ol><ul><li><p>x</p></li></ul>");
    expect(b.map((x) => [x.marker, x.indent, x.runs[0].text])).toEqual([["1.", 1, "eins"], ["2.", 1, "zwei"], ["•", 1, "x"]]);
  });

  it("verwirft leere Absätze und Skripte", () => {
    expect(letterBlocks("<p></p><script>alert(1)</script><p> x </p>")).toEqual([{ indent: 0, runs: [{ text: "x" }] }]);
  });
});

describe("Überschriften (#98)", () => {
  it("h2/h3 werden eigene fette Absätze", () => {
    const b = letterBlocks("<h2>Titel</h2><p>Text <strong>fett</strong></p><h3>Unter</h3>");
    expect(b.map((x) => x.runs)).toEqual([
      [{ text: "Titel", bold: true }],
      [{ text: "Text " }, { text: "fett", bold: true }],
      [{ text: "Unter", bold: true }],
    ]);
  });
});
