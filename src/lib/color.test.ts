import { describe, it, expect } from "vitest";
import { readableForeground } from "./color";

describe("readableForeground", () => {
  it("dunkler Text auf hellem Hintergrund", () => {
    expect(readableForeground("#ffffff")).toBe("#111827");
    expect(readableForeground("#fde047")).toBe("#111827"); // gelb
    expect(readableForeground("#d97706")).toBe("#ffffff"); // Bernstein: mittel -> weiß
  });
  it("weißer Text auf dunklem/sattem Hintergrund", () => {
    expect(readableForeground("#000000")).toBe("#ffffff");
    expect(readableForeground("#2563eb")).toBe("#ffffff"); // Blau
    expect(readableForeground("#4f46e5")).toBe("#ffffff"); // Indigo
  });
  it("Fallback bei ungültiger Eingabe", () => {
    expect(readableForeground(null)).toBe("#ffffff");
    expect(readableForeground("nope")).toBe("#ffffff");
    expect(readableForeground("#fff")).toBe("#ffffff");
  });
});
