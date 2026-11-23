import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  tenant: vi.fn(),
  payment: vi.fn(),
  mandate: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: async () => ({ user: { tenantId: "house", role: "VERWALTER" } }) }));
vi.mock("@/lib/acting-tenant", () => ({ actingTenantId: async () => "house" }));
vi.mock("@/lib/rbac", () => ({ roleAllows: () => true }));
vi.mock("@/lib/tenant-currency", () => ({ getTenantCurrency: async () => (await db.tenant()).currency }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  tenant: { findUnique: db.tenant },
  payment: { findMany: db.payment },
  sepaMandate: { findMany: db.mandate },
} }));

import { GET as datev } from "./datev/route";
import { GET as sepa } from "./sepa/route";

describe("EUR-only export routes", () => {
  beforeEach(() => {
    db.payment.mockResolvedValue([]);
    db.mandate.mockResolvedValue([]);
  });
  afterEach(() => vi.resetAllMocks());

  it.each([datev, sepa])("blocks direct export requests for CZK before loading payment data", async (exportRoute) => {
    db.tenant.mockResolvedValue({ name: "Test", currency: "CZK" });
    const response = await exportRoute();
    expect(response.status).toBe(403);
    expect(response.headers.get("Content-Disposition")).toBeNull();
    expect(db.payment).not.toHaveBeenCalled();
    expect(db.mandate).not.toHaveBeenCalled();
  });

  it.each([datev, sepa])("keeps the existing EUR download available", async (exportRoute) => {
    db.tenant.mockResolvedValue({ name: "Test", currency: "EUR" });
    const response = await exportRoute();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toContain("attachment");
  });
});
