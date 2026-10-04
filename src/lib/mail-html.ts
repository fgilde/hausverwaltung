// Formatierte E-Mails (#56): kleine, abhängigkeitsfreie Helfer für Text <-> HTML.
// Läuft im Browser (Editor-Vorbelegung) wie auf dem Server (Text-Variante beim Versand).
// Bereinigt wird HTML ausschließlich serverseitig (server/mail-sanitize.ts).

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Klartext als HTML-Absätze (Vorlagen, ältere Mails, Editor-Vorbelegung). */
export function textToHtml(text: string): string {
  const paras = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return paras.map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("");
}

/** Antwort-Vorbelegung: leere Zeile zum Schreiben, darunter die zitierte Nachricht. */
export function quoteHtml(text: string): string {
  return `<p></p><blockquote>${textToHtml(text)}</blockquote>`;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " };

/** Text-Variante einer HTML-Mail: Absätze, Listen, Zitate und Links lesbar als Klartext. */
export function htmlToText(html: string): string {
  const out = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, label: string) => {
      const text = label.replace(/<[^>]+>/g, "");
      return text && text !== href ? `${text} (${href})` : href;
    })
    // Listen blockweise: Aufzählung mit „- “, nummeriert mit „1. “ (Tiptap packt Einträge in <p>)
    .replace(/<(ul|ol)[^>]*>([\s\S]*?)<\/\1>/gi, (_m, tag: string, inner: string) => {
      let n = 0;
      const items = inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_x, c: string) =>
        `${tag.toLowerCase() === "ol" ? `${++n}.` : "-"} ${c.replace(/<\/?p[^>]*>/gi, "").trim()}\n`,
      );
      return `\n${items}\n`;
    })
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_m, inner: string) =>
      inner.replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, "").trim().split("\n").map((l) => `> ${l}`).join("\n") + "\n\n",
    )
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/?(ul|p|strong|b|em|i|u|s)[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_m, e: string) => ENTITIES[e]);
  return out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
