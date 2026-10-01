import { describe, it, expect } from "vitest";
import { routing } from "./routing";
import de from "../../messages/de.json";

// Jede Sprache muss alle Schlüssel des deutschen Katalogs enthalten (und keine
// zusätzlichen), sonst fallen Texte zur Laufzeit auf den Schlüsselnamen zurück.
function keys(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe("message catalogs", () => {
  const ref = keys(de).sort();
  for (const locale of routing.locales.filter((l) => l !== "de")) {
    it(`${locale} hat dieselben Schlüssel wie de`, async () => {
      const msgs = (await import(`../../messages/${locale}.json`)).default;
      expect(keys(msgs).sort()).toEqual(ref);
    });
  }
});
