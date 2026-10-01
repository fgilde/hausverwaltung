import "server-only";
import { prisma } from "@/lib/prisma";
import type { AllocationMethod } from "@/lib/allocation";
import { buildWegStatement, scopeUnits } from "@/lib/allocation/weg";
import { meterConsumption } from "@/server/statements";

/**
 * Lädt alles für WEG-Seite und Druckansicht eines Objekts/Jahres und rechnet
 * Hausgeld und Jahresabrechnung inkl. Untergemeinschaften (#42).
 */
export async function computeWeg(tenantId: string, propertyId: string, year: number) {
  const yStart = new Date(Date.UTC(year, 0, 1));
  const yEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59));
  const [property, subcommunities, dbUnits, owners, plan, subPlans, reserves, costs] = await Promise.all([
    prisma.property.findFirst({
      where: { id: propertyId, tenantId, management: "WEG" },
      include: { tenant: { select: { name: true, heatingConsumptionPct: true } } },
    }),
    prisma.subcommunity.findMany({ where: { tenantId, propertyId }, orderBy: { createdAt: "asc" } }),
    prisma.unit.findMany({
      where: { tenantId, building: { propertyId } },
      include: {
        meters: {
          where: { type: { in: ["WAERME", "WASSER_WARM"] } },
          include: { readings: { where: { date: { gte: yStart, lte: yEnd } }, orderBy: { value: "asc" } } },
        },
      },
      orderBy: { label: "asc" },
    }),
    prisma.owner.findMany({ where: { tenantId, unit: { building: { propertyId } } }, include: { person: true, unit: true } }),
    prisma.economicPlan.findUnique({ where: { propertyId_year: { propertyId, year } } }),
    prisma.subcommunityPlan.findMany({ where: { tenantId, year, subcommunity: { propertyId } } }),
    prisma.reserve.findMany({ where: { tenantId, propertyId }, include: { transactions: { orderBy: { date: "desc" } } }, orderBy: { createdAt: "asc" } }),
    prisma.costEntry.findMany({ where: { tenantId, propertyId, year }, orderBy: { type: "asc" } }),
  ]);

  const units = dbUnits.map((u) => ({
    id: u.id,
    label: u.label,
    area: Number(u.area),
    mea: u.mea ?? 0,
    consumption: meterConsumption(u.meters),
    subcommunityId: u.subcommunityId,
  }));
  const tenantPct = property?.tenant.heatingConsumptionPct ?? null;
  const calc = buildWegStatement(
    units,
    owners.map((o) => ({ id: o.id, unitId: o.unitId, share: o.share })),
    costs.map((c) => {
      const heating = c.type === "HEIZUNG" || c.type === "WARMWASSER";
      const pct = c.consumptionSharePct ?? tenantPct;
      return {
        id: c.id,
        amount: Number(c.amount),
        method: c.method as AllocationMethod,
        heating,
        consumptionShare: heating && pct != null ? pct / 100 : undefined,
        subcommunityId: c.subcommunityId,
      };
    }),
    [
      ...(plan ? [{ subcommunityId: null, total: Number(plan.totalAmount) }] : []),
      ...subPlans.map((p) => ({ subcommunityId: p.subcommunityId, total: Number(p.totalAmount) })),
    ],
  );

  const sum = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100;
  // Übersicht je Kreis: Gesamt-WEG und jede Untergemeinschaft.
  const scopes = [
    { id: null as string | null, name: null as string | null },
    ...subcommunities.map((s) => ({ id: s.id as string | null, name: s.name as string | null })),
  ].map((s) => {
    const su = scopeUnits(units, s.id);
    return {
      ...s,
      units: su,
      meaSum: Math.round(su.reduce((a, u) => a + u.mea, 0) * 10_000) / 10_000,
      costTotal: sum(costs.filter((c) => c.subcommunityId === s.id).map((c) => Number(c.amount))),
      planTotal: s.id ? Number(subPlans.find((p) => p.subcommunityId === s.id)?.totalAmount ?? 0) : Number(plan?.totalAmount ?? 0),
      planNote: s.id ? (subPlans.find((p) => p.subcommunityId === s.id)?.note ?? null) : (plan?.note ?? null),
      hasPlan: s.id ? subPlans.some((p) => p.subcommunityId === s.id) : !!plan,
    };
  });

  const lineByOwner = new Map(calc.owners.map((l) => [l.id, l]));
  return {
    property,
    subcommunities,
    units,
    owners: owners.map((o) => ({
      ...o,
      line: lineByOwner.get(o.id) ?? { allocated: 0, hausgeld: 0, balance: 0 },
    })),
    // Einheiten ohne Eigentümer tragen trotzdem ihren Anteil (nicht auf andere verteilt).
    unassigned: units
      .filter((u) => !owners.some((o) => o.unitId === u.id))
      .map((u) => ({ unit: u, allocated: calc.unitCost.get(u.id) ?? 0, hausgeld: calc.unitHausgeld.get(u.id) ?? 0 }))
      .filter((x) => x.allocated > 0 || x.hausgeld > 0),
    costs,
    actualTotal: sum(costs.map((c) => Number(c.amount))),
    scopes,
    reserves: reserves.map((r) => ({ r, balance: sum(r.transactions.map((tx) => Number(tx.amount))) })),
  };
}

/** Gehört die Untergemeinschaft zu Mandant und Objekt? Leer = Gesamt-WEG (ok). */
export async function subcommunityValid(tenantId: string, propertyId: string, id: string | undefined | null) {
  if (!id) return true;
  return !!(await prisma.subcommunity.findFirst({ where: { id, tenantId, propertyId }, select: { id: true } }));
}
