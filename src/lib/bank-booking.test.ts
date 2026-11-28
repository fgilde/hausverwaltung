import { describe, it, expect } from "vitest";
import { newBookings, payerMatches, takeCharge, type OpenCharge, type Payer } from "./bank-booking";

const b = (date: string, amount: number, reference = "Miete") => ({ date, amount, direction: "EINGANG", reference });

describe("newBookings (#92)", () => {
  it("überspringt einen erneut importierten Auszug komplett", () => {
    const file = [b("2026-11-03", 800), b("2026-11-03", 120, "NK")];
    expect(newBookings(file, file)).toEqual([]);
  });

  it("überlappende Auszüge: nur die neuen Tage kommen dazu", () => {
    const existing = [b("2026-11-03", 800)];
    expect(newBookings([b("2026-11-03", 800), b("2026-11-20", 800)], existing)).toEqual([b("2026-11-20", 800)]);
  });

  it("zwei gleiche Buchungen im Auszug, eine schon da: die zweite kommt dazu", () => {
    const e = b("2026-11-03", 50, "Spende");
    expect(newBookings([e, e], [e])).toEqual([e]);
  });
});

const mueller: Payer = { firstName: "Hans", lastName: "Müller", iban: "DE02 1203 0000 0000 2020 51", accountHolder: null };
const meier: Payer = { firstName: "Eva", lastName: "Meier", iban: null, accountHolder: "Eva und Tom Meier" };

describe("payerMatches", () => {
  it("IBAN gleich, Schreibweise egal", () => expect(payerMatches(mueller, null, "DE02120300000000202051")).toBe(true));
  it("Nachname mit Umlaut-Umschrift", () => expect(payerMatches(mueller, "MUELLER, HANS", null)).toBe(true));
  it("Kontoinhaber", () => expect(payerMatches(meier, "Tom Meier und Eva", null)).toBe(true));
  it("fremder Zahler", () => expect(payerMatches(mueller, "Stadtwerke", "DE89370400440532013000")).toBe(false));
  it("ohne Gegenseite keine Zuordnung", () => expect(payerMatches(mueller, undefined, undefined)).toBe(false));
});

describe("takeCharge", () => {
  const open = (): OpenCharge[] => [
    { id: "meier-nov", open: 800, payers: [meier] },
    { id: "mueller-nov", open: 800, payers: [mueller] },
  ];

  it("gleicher Betrag bei zwei Mietern: nimmt den passenden Zahler", () => {
    expect(takeCharge(open(), { amount: 800, direction: "EINGANG", counterparty: "Hans Müller" })).toBe("mueller-nov");
  });

  it("nur Betrag passt, Zahler unbekannt: bleibt unzugeordnet", () => {
    expect(takeCharge(open(), { amount: 800, direction: "EINGANG", counterparty: "Umbuchung Rücklage" })).toBeNull();
  });

  it("verbraucht die Sollstellung und ignoriert Ausgänge", () => {
    const o = open();
    expect(takeCharge(o, { amount: 800, direction: "EINGANG", counterparty: "Meier" })).toBe("meier-nov");
    expect(takeCharge(o, { amount: 800, direction: "EINGANG", counterparty: "Meier" })).toBeNull();
    expect(takeCharge(open(), { amount: 800, direction: "AUSGANG", counterparty: "Meier" })).toBeNull();
  });
});
