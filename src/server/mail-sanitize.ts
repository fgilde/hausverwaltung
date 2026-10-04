import "server-only";
import sanitizeHtml from "sanitize-html";

// Nur die Formatierungen des Editors (#56) durchlassen. Alles andere (Skripte,
// Styles, Event-Handler, fremde Tags) fliegt raus, bevor HTML gespeichert,
// angezeigt oder versendet wird.
export function sanitizeMailHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "a", "blockquote"],
    allowedAttributes: { a: ["href", "target", "rel"] }, // target/rel setzt transformTags fest
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }),
    },
    allowedSchemesAppliedToAttributes: ["href"],
  }).trim();
}

/** Leerer Editor liefert „<p></p>“, das zählt als kein Inhalt. */
export function isEmptyHtml(html: string): boolean {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).trim() === "";
}
