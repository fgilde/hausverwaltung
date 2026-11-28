import { decodeEntities, textToHtml } from "@/lib/mail-html";

// Brieftext (#67): Editor-HTML (Tiptap) → Absätze mit formatierten Textstücken
// für den PDF-Satz. Unterstützt fett, kursiv, unterstrichen, Listen, Zitate, Zeilenumbrüche,
// Überschriften (#98, als fetter Absatz).
// Alles andere wird als Klartext übernommen. Ältere Briefe/Vorlagen sind reiner Text.

export type Run = { text: string; bold?: boolean; italic?: boolean; underline?: boolean };
export type Block = { runs: Run[]; indent: number; marker?: string };

const INLINE: Record<string, keyof Omit<Run, "text">> = { b: "bold", strong: "bold", i: "italic", em: "italic", u: "underline" };

export function letterBlocks(body: string): Block[] {
  const html = /<[a-z][^>]*>/i.test(body) ? body : textToHtml(body);
  const blocks: Block[] = [];
  const style: Record<string, number> = { bold: 0, italic: 0, underline: 0 };
  const lists: { ordered: boolean; n: number }[] = [];
  let quote = 0;
  let cur: Block | null = null;
  let pendingMarker: string | undefined;

  const block = () => {
    if (!cur) {
      cur = { runs: [], indent: lists.length + quote, ...(pendingMarker ? { marker: pendingMarker } : {}) };
      pendingMarker = undefined;
      blocks.push(cur);
    }
    return cur;
  };
  const close = () => (cur = null);

  for (const m of html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "").matchAll(/<(\/?)([a-z0-9]+)[^>]*>|([^<]+)/gi)) {
    const [, slash, rawTag, text] = m;
    if (text !== undefined) {
      const t = decodeEntities(text).replace(/\s+/g, " ");
      if (!t.trim() && !cur) continue;
      block().runs.push({
        text: t,
        ...(style.bold ? { bold: true } : {}),
        ...(style.italic ? { italic: true } : {}),
        ...(style.underline ? { underline: true } : {}),
      });
      continue;
    }
    const tag = rawTag.toLowerCase();
    const end = slash === "/";
    if (INLINE[tag]) style[INLINE[tag]] += end ? -1 : 1;
    else if (tag === "br") block().runs.push({ text: "\n" });
    else if (tag === "p") close();
    else if (tag === "h1" || tag === "h2" || tag === "h3") {
      close();
      style.bold += end ? -1 : 1;
    }
    else if (tag === "ul" || tag === "ol") {
      close();
      if (end) lists.pop();
      else lists.push({ ordered: tag === "ol", n: 0 });
    } else if (tag === "li" && !end) {
      close();
      const l = lists[lists.length - 1];
      pendingMarker = l?.ordered ? `${++l.n}.` : "•";
    } else if (tag === "li") close();
    else if (tag === "blockquote") {
      close();
      quote += end ? -1 : 1;
    }
  }
  // Leerzeichen an Absatzgrenzen entfernen, leere Absätze verwerfen
  return blocks
    .map((b) => {
      const runs = b.runs.slice();
      if (runs.length) runs[0] = { ...runs[0], text: runs[0].text.trimStart() };
      if (runs.length) runs[runs.length - 1] = { ...runs[runs.length - 1], text: runs[runs.length - 1].text.trimEnd() };
      return { ...b, runs: runs.filter((r) => r.text) };
    })
    .filter((b) => b.runs.length > 0);
}
