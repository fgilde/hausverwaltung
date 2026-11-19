import { expect, it, vi } from "vitest";
import { syncLink } from "./bank-sync";

const db = vi.hoisted(() => ({
  bankLink: { findFirst: vi.fn(), update: vi.fn() },
  payment: { findFirst: vi.fn(), createMany: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/adapters/enablebanking", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/adapters/enablebanking")>(),
  getTransactions: vi.fn().mockResolvedValue([{
    transaction_id: "sample-bank-ref",
    booking_date: "2025-11-28",
    credit_debit_indicator: "CRDT",
    transaction_amount: { amount: "812.34" },
    remittance_information: ["Umbuchung Giro an Rücklage"],
  }]),
  getBalances: vi.fn().mockResolvedValue([]),
}));

it("leaves a synced receipt for review without querying open charges", async () => {
  db.bankLink.findFirst.mockResolvedValue({ accountUid: "k", accountId: "a", lastSyncAt: null });
  db.payment.findFirst.mockResolvedValue(null);
  db.payment.createMany.mockResolvedValue({ count: 1 });
  expect(await syncLink("t", "link", { applicationId: "app", privateKeyPem: "mock" }))
    .toEqual({ imported: 1, matched: 0 });
  const input = db.payment.createMany.mock.calls[0][0];
  expect(input.data).toMatchObject({ accountId: "a", amount: 812.34, direction: "EINGANG" });
  expect(input.data.externalId).toMatch(/^eb:.*:a$/);
  expect(input.data).not.toHaveProperty("chargeId");
  expect(input.skipDuplicates).toBe(true);
});
