import { describe, it, expect } from "vitest";
import { pickCustom } from "./custom";

describe("pickCustom", () => {
  it("nimmt nur cf_-Keys, entfernt Präfix, ignoriert Leeres", () => {
    const r = pickCustom({ name: "Haus", cf_baujahr: "1998", cf_energie: "", cf_lage: " Süd " });
    expect(r).toEqual({ baujahr: "1998", lage: "Süd" });
  });

  it("leer wenn keine cf_-Keys", () => {
    expect(pickCustom({ name: "x", street: "y" })).toEqual({});
  });
});
