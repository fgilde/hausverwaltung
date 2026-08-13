import { describe, it, expect } from "vitest";
import { toCsv, parseCsv } from "./csv";

describe("parseCsv", () => {
  it("parst Semikolon-CSV mit BOM + Header", () => {
    const csv = "﻿firstName;lastName;email\r\nErika;Muster;e@x.de\r\nMax;Klein;m@x.de";
    const rows = parseCsv(csv);
    expect(rows).toEqual([
      ["firstName", "lastName", "email"],
      ["Erika", "Muster", "e@x.de"],
      ["Max", "Klein", "m@x.de"],
    ]);
  });

  it("respektiert Anführungszeichen mit Trenner/Quote innen", () => {
    const rows = parseCsv('a;b\r\n"Müller; Sohn";"sagt ""hi"""');
    expect(rows[1]).toEqual(["Müller; Sohn", 'sagt "hi"']);
  });

  it("erkennt Komma-Trenner + verwirft leere Zeilen", () => {
    const rows = parseCsv("a,b\n1,2\n\n3,4\n");
    expect(rows).toEqual([["a", "b"], ["1", "2"], ["3", "4"]]);
  });

  it("Roundtrip toCsv -> parseCsv", () => {
    const csv = toCsv(["Name", "Ort"], [["A;B", "Berlin"], ["C", "Köln"]]);
    const rows = parseCsv(csv);
    expect(rows[1]).toEqual(["A;B", "Berlin"]);
  });
});
