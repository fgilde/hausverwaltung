import "server-only";
import { prisma } from "@/lib/prisma";
import { afaForYear } from "@/lib/afa";
import { recurringComponentAmountAt } from "@/lib/rent-components";

// Anlage-V-Übersicht (#103) je Objekt und Jahr. Einnahmen nach Zuflussprinzip (§ 11 EStG):
// Zahlungen im Jahr, die Sollstellungen von Verträgen bzw. Teilflächen des Objekts zugeordnet
// sind. Werbungskosten: AfA und Kostenpositionen des Jahres (nach Kostenjahr, nicht Zahlungsdatum).
// ponytail: keine Verteilung großer Erhaltungsaufwendungen (§ 82b EStDV), keine Aufteilung
// auf mehrere Eigentümer; beides wäre eine eigene Stufe.

/** Typen, die als Umlagen zählen: Vorauszahlungen und Betriebskostenpauschale (#110). */
const UMLAGE_TYPES = ["NEBENKOSTEN", "HEIZKOSTEN", "PAUSCHALE"];
/** Einheiten, deren Miete „Wohnungen“ ist; alles andere = andere Räume. */
const RESIDENTIAL = ["WOHNUNG", "ZIMMER"];

export type AnlageVRow = { key: string; label?: string; amount: number };
export type AnlageV = {
  income: AnlageVRow[];
  expenses: AnlageVRow[];
  incomeTotal: number;
  expenseTotal: number;
  surplus: number;
  afa: { amount: number; rate: number; restAfter: number } | null;
  unassignedReceipts: number;
};

const cents = (n: number) => Math.round(n * 100) / 100;

/** Anteil der Umlagen an einer MIETE-Sollstellung, aus den Vertragsbestandteilen im Sollmonat. */
export function umlageShare(
  rentCold: number,
  components: { type: string; amount: unknown; effectiveDate: Date | null; endDate?: Date | null }[],
  period: Date,
  leaseStart?: Date,
): number {
  // Bestandteile ab Vertragsbeginn gelten schon im angebrochenen Einzugsmonat (wie die Sollstellung).
  components = components.map((c) => (leaseStart && c.effectiveDate && c.effectiveDate <= leaseStart ? { ...c, effectiveDate: null } : c));
  const umlage = recurringComponentAmountAt(components.filter((c) => UMLAGE_TYPES.includes(c.type)), period);
  const warm = rentCold + recurringComponentAmountAt(components, period);
  return warm > 0 ? umlage / warm : 0;
}

export async function computeAnlageV(tenantId: string, propertyId: string, year: number): Promise<AnlageV | null> {
  const property = await prisma.property.findFirst({ where: { id: propertyId, tenantId } });
  if (!property) return null;
  const from = new Date(Date.UTC(year, 0, 1));
  const to = new Date(Date.UTC(year + 1, 0, 1));
  const ofProperty = {
    OR: [{ lease: { unit: { building: { propertyId } } } }, { areaAllocation: { propertyId } }],
  };

  const [payments, splitMonths, costs, unassignedReceipts] = await Promise.all([
    prisma.payment.findMany({
      where: { tenantId, date: { gte: from, lt: to }, charge: ofProperty },
      include: {
        charge: {
          include: {
            lease: {
              select: {
                id: true,
                rentCold: true,
                startDate: true,
                unit: { select: { type: true } },
                components: { select: { type: true, amount: true, effectiveDate: true, endDate: true } },
              },
            },
          },
        },
      },
    }),
    // Monate mit eigener NEBENKOSTEN-Sollstellung (getrennte Sollstellung #109): MIETE ist dort reine Miete.
    prisma.charge.findMany({ where: { tenantId, type: "NEBENKOSTEN", leaseId: { not: null }, ...ofProperty }, select: { leaseId: true, period: true } }),
    prisma.costEntry.findMany({ where: { tenantId, propertyId, year }, select: { type: true, amount: true } }),
    prisma.payment.count({ where: { tenantId, direction: "EINGANG", chargeId: null, date: { gte: from, lt: to } } }),
  ]);
  const split = new Set(splitMonths.map((c) => `${c.leaseId}|${c.period.toISOString()}`));

  let rentResidential = 0;
  let rentOther = 0;
  let umlagen = 0;
  let other = 0;
  for (const p of payments) {
    const c = p.charge!;
    if (c.type === "KAUTION" || c.type === "HAUSGELD") continue;
    const amount = Number(p.amount);
    if (p.direction === "AUSGANG") {
      umlagen -= amount; // Erstattungen an Mieter (Guthaben) mindern die Umlagen
      continue;
    }
    if (c.type === "NEBENKOSTEN") umlagen += amount;
    else if (c.type === "SONSTIGES") other += amount;
    else {
      // MIETE: Kaltmiete (+ übrige Bestandteile) und Umlagen anteilig nach Vertrag im Sollmonat
      const l = c.lease;
      const share = l && !split.has(`${l.id}|${c.period.toISOString()}`) ? umlageShare(Number(l.rentCold), l.components, c.period, l.startDate) : 0;
      umlagen += amount * share;
      if (l && RESIDENTIAL.includes(l.unit.type)) rentResidential += amount * (1 - share);
      else rentOther += amount * (1 - share); // Gewerbe, Stellplatz, Teilflächen (#areaModel)
    }
  }

  const afa =
    property.afaBasis != null && property.afaStart
      ? afaForYear(
          {
            basis: Number(property.afaBasis),
            start: property.afaStart,
            rate: property.afaRate != null ? Number(property.afaRate) : null,
            degressive: property.afaDegressive,
            buildYear: property.buildYear,
          },
          year,
        )
      : null;

  const byType = new Map<string, number>();
  for (const c of costs) byType.set(c.type, (byType.get(c.type) ?? 0) + Number(c.amount));

  const income: AnlageVRow[] = [
    { key: "rentResidential", amount: cents(rentResidential) },
    { key: "rentOther", amount: cents(rentOther) },
    { key: "umlagen", amount: cents(umlagen) },
    { key: "otherIncome", amount: cents(other) },
  ];
  const expenses: AnlageVRow[] = [
    ...(afa ? [{ key: "afa", amount: afa.amount }] : []),
    ...[...byType].sort(([a], [b]) => a.localeCompare(b)).map(([type, amount]) => ({ key: "cost", label: type, amount: cents(amount) })),
  ];
  const incomeTotal = cents(income.reduce((a, r) => a + r.amount, 0));
  const expenseTotal = cents(expenses.reduce((a, r) => a + r.amount, 0));
  return {
    income,
    expenses,
    incomeTotal,
    expenseTotal,
    surplus: cents(incomeTotal - expenseTotal),
    afa: afa ? { amount: afa.amount, rate: afa.rate, restAfter: afa.restAfter } : null,
    unassignedReceipts,
  };
}
