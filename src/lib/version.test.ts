import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fullVersion } from "./version";
import pkg from "../../package.json";

describe("Versionsnummer", () => {
  it("Version + Build-Nummer wie im Image-Tag", () => {
    expect(fullVersion("0.4.0", "92")).toBe("0.4.0.92");
    expect(fullVersion("0.4.0", "dev")).toBe("0.4.0-dev");
  });

  // Store-Manifeste müssen dieselbe Version wie package.json tragen, sonst
  // zeigen Umbrel/CasaOS eine veraltete Version an.
  it.each([
    ["fgilde-havewa/umbrel-app.yml", /^version:\s*"([^"]+)"/m],
    ["store/casaos/Apps/HaVeWa/docker-compose.yml", /^\s+version:\s*"([^"]+)"/m],
  ])("%s hat die Version aus package.json", (file, re) => {
    const m = readFileSync(file, "utf-8").match(re);
    expect(m?.[1]).toBe(pkg.version);
  });
});
