import { describe, it, expect, vi } from "vitest";
import { textToHtml, quoteHtml, htmlToText, escapeHtml } from "./mail-html";

vi.mock("server-only", () => ({}));
const { sanitizeMailHtml, isEmptyHtml } = await import("../server/mail-sanitize");

describe("Formatierte E-Mails (#56)", () => {
  it("Text wird zu escapten Absätzen", () => {
    expect(textToHtml("Hallo <Max>,\nZeile 2\n\nNeuer Absatz")).toBe("<p>Hallo &lt;Max&gt;,<br>Zeile 2</p><p>Neuer Absatz</p>");
    expect(quoteHtml("x")).toBe("<p></p><blockquote><p>x</p></blockquote>");
    expect(escapeHtml('"&')).toBe("&quot;&amp;");
  });
  it("Text-Variante: Listen, Links, Zitat, Formatierung", () => {
    const html =
      '<p>Hallo <strong>Max</strong>,</p><ul><li>eins</li><li>zwei</li></ul><ol><li>a</li><li>b</li></ol>' +
      '<p>siehe <a href="https://havewa.app">Portal</a></p><blockquote><p>alt</p></blockquote>';
    expect(htmlToText(html)).toBe("Hallo Max,\n\n- eins\n- zwei\n\n1. a\n2. b\n\nsiehe Portal (https://havewa.app)\n\n> alt");
  });
  it("Bereinigung: nur erlaubte Tags, sichere Links", () => {
    const dirty = '<p onclick="x()">Hi<script>alert(1)</script> <a href="javascript:alert(1)">x</a> <a href="https://a.de" target="_self">a</a><img src=x onerror=1></p><h1>T</h1>';
    const clean = sanitizeMailHtml(dirty);
    expect(clean).not.toMatch(/script|onclick|onerror|javascript|<img|<h1/);
    expect(clean).toContain('<a href="https://a.de" target="_blank" rel="noopener noreferrer">a</a>');
    expect(isEmptyHtml("<p></p>")).toBe(true);
    expect(isEmptyHtml("<p>x</p>")).toBe(false);
  });
});
