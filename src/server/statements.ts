import "server-only";
import { prisma } from "@/lib/prisma";
import { buildStatement, type UnitInput, type CostInput } from "@/lib/allocation/statement";
import type { AllocationMethod } from "@/lib/allocation";

export interface StatementUnit {
  id: string;
  label: string;
  leaseId: string | null;
  renterEmails: string[];
  renterNames: string[];
  allocated: number;
  prepayment: number;
  balance: number; // >0 Guthaben, <0 Nachzahlung
}

export interface StatementResult {
  property: { id: string; name: string; street: string; zip: string; city: string; tenantName: string } | null;
  costs: { id: string; type: string; amount: number; method: string; umlagefaehig: boolean; note: string | null }[];
  units: StatementUnit[];
  totalUmlage: number;
}

/**
 * Lädt Einheiten, Verträge, Zählerstände und Kosten eines Objekts/Jahres und
 * berechnet die Betriebskostenabrechnung (BetrKV + HeizkostenV). Geteilte Basis
 * für Abrechnungs-Seite, Druckansicht und die Buchungs-/E-Mail-Aktionen.
 */
export async function computeStatement(
  tenantId: string,
  propertyId: string,
  year: number,
): Promise<StatementResult> {
  const yStart = new Date(Date.UTC(year, 0, 1));
  const yEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59));

  const [property, dbUnits, costs] = await Promise.all([
    prisma.property.findFirst({
      where: { id: propertyId, tenantId },
      include: { tenant: { select: { name: true } } },
    }),
    prisma.unit.findMany({
      where: { tenantId, building: { propertyId } },
      include: {
        leases: {
          where: { startDate: { lte: yEnd }, OR: [{ endDate: null }, { endDate: { gte: yStart } }] },
          include: { components: true, renters: { include: { person: true } } },
          orderBy: { startDate: "desc" },
          take: 1,
        },
        meters: {
          where: { type: { in: ["WAERME", "WASSER_WARM"] } },
          include: { readings: { where: { date: { gte: yStart, lte: yEnd } }, orderBy: { value: "asc" } } },
        },
      },
    }),
    prisma.costEntry.findMany({ where: { tenantId, propertyId, year }, orderBy: { type: "asc" } }),
  ]);

  const inputs: UnitInput[] = dbUnits.map((u) => {
    const lease = u.leases[0];
    const prepaymentMonthly = lease
      ? lease.components.filter((c) => c.type === "NEBENKOSTEN" || c.type === "HEIZKOSTEN").reduce((a, c) => a + Number(c.amount), 0)
      : 0;
    const consumption = u.meters.reduce((sum, m) => {
      const vals = m.readings.map((r) => Number(r.value));
      return sum + (vals.length >= 2 ? vals[vals.length - 1] - vals[0] : 0);
    }, 0);
    return {
      id: u.id,
      label: u.label,
      area: Number(u.area),
      persons: lease?.personCount ?? 1,
      mea: u.mea ?? undefined,
      prepayment: prepaymentMonthly * 12,
      consumption,
    };
  });

  const costInputs: CostInput[] = costs.map((c) => ({
    id: c.id,
    amount: Number(c.amount),
    method: c.method as AllocationMethod,
    umlagefaehig: c.umlagefaehig,
    heating: c.type === "HEIZUNG" || c.type === "WARMWASSER",
  }));

  const { lines, totalUmlage } = buildStatement(inputs, costInputs);
  const byId = new Map(lines.map((l) => [l.unitId, l]));

  const units: StatementUnit[] = dbUnits.map((u) => {
    const line = byId.get(u.id);
    const lease = u.leases[0];
    const renters = lease?.renters ?? [];
    return {
      id: u.id,
      label: u.label,
      leaseId: lease?.id ?? null,
      renterEmails: renters.map((r) => r.person.email).filter((e): e is string => !!e),
      renterNames: renters.map((r) => `${r.person.firstName} ${r.person.lastName}`),
      allocated: line?.allocated ?? 0,
      prepayment: line?.prepayment ?? 0,
      balance: line?.balance ?? 0,
    };
  });

  return {
    property: property
      ? { id: property.id, name: property.name, street: property.street, zip: property.zip, city: property.city, tenantName: property.tenant.name }
      : null,
    costs: costs.map((c) => ({ id: c.id, type: c.type, amount: Number(c.amount), method: c.method, umlagefaehig: c.umlagefaehig, note: c.note })),
    units,
    totalUmlage,
  };
}
