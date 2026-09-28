import { describe, it, expect } from "vitest";
import { dedupKey, matchPersonId, isSyncDue, clampSyncInterval, selectAttachments, clampAttachMaxMb, MAX_ATTACHMENTS_PER_MAIL } from "./inbound";

describe("Auto-Sync-Fälligkeit (#39)", () => {
  const now = new Date("2026-09-28T12:00:00Z");
  it("noch nie synchronisiert → fällig", () => {
    expect(isSyncDue(null, 30, now)).toBe(true);
  });
  it("vor 29 Min → nicht fällig, vor 30 Min → fällig", () => {
    expect(isSyncDue(new Date(now.getTime() - 29 * 60_000), 30, now)).toBe(false);
    expect(isSyncDue(new Date(now.getTime() - 30 * 60_000), 30, now)).toBe(true);
  });
  it("Intervall wird auf 5 Min … 24 h begrenzt", () => {
    expect(clampSyncInterval(1)).toBe(5);
    expect(clampSyncInterval(99999)).toBe(1440);
    expect(clampSyncInterval(null)).toBe(30);
    expect(clampSyncInterval(15)).toBe(15);
  });
});

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

describe("Anhänge eingehender Mails (#39)", () => {
  const a = (size: number, related = false) => ({ filename: "x.pdf", contentType: "application/pdf", size, related });
  it("filtert eingebettete Bilder, leere und zu große Dateien", () => {
    const r = selectAttachments([a(100), a(100, true), a(0), a(2_000_000), a(1_000_000)], 1_000_000);
    expect(r.map((x) => x.size)).toEqual([100, 1_000_000]);
  });
  it("höchstens MAX_ATTACHMENTS_PER_MAIL", () => {
    expect(selectAttachments(Array.from({ length: 30 }, () => a(1)), 10)).toHaveLength(MAX_ATTACHMENTS_PER_MAIL);
  });
  it("Max-Größe wird auf 1 … 50 MB begrenzt", () => {
    expect(clampAttachMaxMb(0)).toBe(10);
    expect(clampAttachMaxMb(500)).toBe(50);
    expect(clampAttachMaxMb(5)).toBe(5);
  });
});
