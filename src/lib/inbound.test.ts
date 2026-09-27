import { describe, it, expect } from "vitest";
import { dedupKey, matchPersonId } from "./inbound";

const d = (s: string) => new Date(s + "T00:00:00Z");

describe("dedupKey (#39 Inbound)", () => {
  it("nutzt die Message-ID wenn vorhanden", () => {
    expect(dedupKey({ messageId: "<abc@x>", fromAddress: "a@b.de", subject: "Hi", receivedAt: d("2026-01-01") })).toBe("<abc@x>");
  });
  it("Fallback ohne Message-ID ist stabil", () => {
    const m = { messageId: null, fromAddress: "A@B.de", subject: "Hi", receivedAt: d("2026-01-01") };
    expect(dedupKey(m)).toBe("a@b.de|2026-01-01T00:00:00.000Z|Hi");
  });
  it("leere Message-ID → Fallback", () => {
    const m = { messageId: "  ", fromAddress: "a@b.de", subject: null, receivedAt: d("2026-01-01") };
    expect(dedupKey(m)).toBe("a@b.de|2026-01-01T00:00:00.000Z|");
  });
});

describe("matchPersonId (#39 Inbound)", () => {
  const persons = [
    { id: "p1", email: "Max@Example.de" },
    { id: "p2", email: null },
    { id: "p3", email: "erika@example.de" },
  ];
  it("case-insensitiver Treffer", () => {
    expect(matchPersonId("max@example.de", persons)).toBe("p1");
  });
  it("kein Treffer → null", () => {
    expect(matchPersonId("unbekannt@x.de", persons)).toBeNull();
  });
  it("leere Adresse → null", () => {
    expect(matchPersonId("", persons)).toBeNull();
  });
});
