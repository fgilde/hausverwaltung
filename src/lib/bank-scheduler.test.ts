import { describe, it, expect } from "vitest";
import { isBankSyncDue } from "./bank-scheduler";

describe("Bank-Auto-Sync höchstens täglich (#54)", () => {
  const now = new Date("2026-10-02T12:00:00Z");
  it("noch nie synchronisiert → fällig", () => expect(isBankSyncDue(null, now)).toBe(true));
  it("vor 23 h → nicht fällig, vor 24 h → fällig", () => {
    expect(isBankSyncDue(new Date(now.getTime() - 23 * 3600_000), now)).toBe(false);
    expect(isBankSyncDue(new Date(now.getTime() - 24 * 3600_000), now)).toBe(true);
  });
});
