import { describe, it, expect } from "vitest";
import { parseDocumentLink, documentLinkData, documentLinkOf } from "./document-links";

describe("Dokument-Vorgang (#99)", () => {
  it("liest art:id und verwirft Unbekanntes", () => {
    expect(parseDocumentLink("ticket:abc")).toEqual({ kind: "ticket", id: "abc" });
    expect(parseDocumentLink("foo:abc")).toBeNull();
    expect(parseDocumentLink("")).toBeNull();
  });
  it("setzt genau eine Spalte und löst die übrigen", () => {
    expect(documentLinkData({ kind: "cost", id: "c1" })).toEqual({
      leaseId: null, ticketId: null, maintenanceContractId: null, insuranceId: null, costEntryId: "c1", noteId: null,
    });
    expect(Object.values(documentLinkData(null)).every((v) => v === null)).toBe(true);
  });
  it("Formularwert aus dem Dokument", () => {
    expect(documentLinkOf({ maintenanceContractId: "m1" })).toBe("maintenance:m1");
    expect(documentLinkOf({})).toBe("");
  });
});
