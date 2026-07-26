import { describe, it, expect } from "vitest";
import { renderTemplate, extractPlaceholders } from "./template";

describe("renderTemplate", () => {
  it("ersetzt bekannte Platzhalter, toleriert Whitespace", () => {
    const out = renderTemplate("Hallo {{name}}, Objekt {{ objekt }}.", { name: "Erika", objekt: "Lindenstr." });
    expect(out).toBe("Hallo Erika, Objekt Lindenstr..");
  });

  it("lässt unbekannte Platzhalter stehen", () => {
    expect(renderTemplate("X {{fehlt}} Y", {})).toBe("X {{fehlt}} Y");
  });

  it("ersetzt mehrfach", () => {
    expect(renderTemplate("{{a}}-{{a}}", { a: "1" })).toBe("1-1");
  });
});

describe("extractPlaceholders", () => {
  it("liefert deduplizierte Schlüssel", () => {
    expect(extractPlaceholders("{{a}} {{ b }} {{a}}").sort()).toEqual(["a", "b"]);
  });
});
