import { prisma } from "@/lib/prisma";

// Geteilte, mandanten-gescopte Datenschicht für REST-API und MCP-Server.
// Alle Funktionen erhalten die tenantId aus dem authentifizierten Token.

const num = (d: unknown) => (d == null ? null : Number(d as number));

export async function listProperties(tenantId: string) {
  const rows = await prisma.property.findMany({
    where: { tenantId },
    include: { buildings: { include: { _count: { select: { units: true } } } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    street: p.street,
    zip: p.zip,
    city: p.city,
    type: p.type,
    management: p.management,
    units: p.buildings.reduce((a, b) => a + b._count.units, 0),
  }));
}

export async function getProperty(tenantId: string, id: string) {
  const p = await prisma.property.findFirst({
    where: { id, tenantId },
    include: { buildings: { include: { units: true } } },
  });
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    street: p.street,
    zip: p.zip,
    city: p.city,
    type: p.type,
    management: p.management,
    meaTotal: p.meaTotal,
    buildings: p.buildings.map((b) => ({
      id: b.id,
      name: b.name,
      units: b.units.map((u) => ({ id: u.id, label: u.label, type: u.type, area: num(u.area), mea: u.mea })),
    })),
  };
}

export async function listUnits(tenantId: string) {
  const rows = await prisma.unit.findMany({
    where: { tenantId },
    include: { building: { include: { property: { select: { name: true } } } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((u) => ({
    id: u.id,
    label: u.label,
    type: u.type,
    area: num(u.area),
    rooms: num(u.rooms),
    mea: u.mea,
    property: u.building.property.name,
    building: u.building.name,
  }));
}

export async function listPersons(tenantId: string) {
  const rows = await prisma.person.findMany({
    where: { tenantId },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  return rows.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    email: p.email,
    phone: p.phone,
    type: p.type,
  }));
}

export async function listLeases(tenantId: string) {
  const rows = await prisma.lease.findMany({
    where: { tenantId },
    include: {
      unit: { include: { building: { include: { property: { select: { name: true } } } } } },
      renters: { include: { person: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: { startDate: "desc" },
  });
  return rows.map((l) => ({
    id: l.id,
    property: l.unit.building.property.name,
    unit: l.unit.label,
    tenants: l.renters.map((r) => `${r.person.firstName} ${r.person.lastName}`),
    rentCold: num(l.rentCold),
    startDate: l.startDate.toISOString().slice(0, 10),
    endDate: l.endDate ? l.endDate.toISOString().slice(0, 10) : null,
  }));
}

export async function listTickets(tenantId: string) {
  const rows = await prisma.ticket.findMany({
    where: { tenantId },
    include: { property: { select: { name: true } }, assignee: { select: { name: true } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  return rows.map((t) => ({
    id: t.id,
    title: t.title,
    category: t.category,
    status: t.status,
    priority: t.priority,
    property: t.property?.name ?? null,
    assignee: t.assignee?.name ?? null,
    dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
  }));
}

export async function listOpenItems(tenantId: string) {
  const charges = await prisma.charge.findMany({
    where: { tenantId },
    include: {
      payments: { select: { amount: true } },
      lease: { include: { unit: { include: { building: { include: { property: { select: { name: true } } } } } } } },
    },
    orderBy: { dueDate: "desc" },
  });
  const now = new Date();
  return charges
    .map((c) => {
      const paid = c.payments.reduce((a, p) => a + Number(p.amount), 0);
      const open = Number(c.amount) - paid;
      return {
        id: c.id,
        type: c.type,
        period: c.period.toISOString().slice(0, 10),
        dueDate: c.dueDate.toISOString().slice(0, 10),
        amount: Number(c.amount),
        open: Math.round(open * 100) / 100,
        overdue: open > 0.005 && c.dueDate < now,
        property: c.lease?.unit.building.property.name ?? null,
      };
    })
    .filter((c) => c.open > 0.005);
}

export async function createTicket(
  tenantId: string,
  data: { title: string; description?: string; propertyId?: string; priority?: string },
) {
  const propertyId =
    data.propertyId &&
    (await prisma.property.findFirst({ where: { id: data.propertyId, tenantId }, select: { id: true } }))
      ? data.propertyId
      : null;
  const created = await prisma.ticket.create({
    data: {
      tenantId,
      title: data.title,
      description: data.description ?? null,
      propertyId,
      priority: (data.priority as "NIEDRIG" | "MITTEL" | "HOCH") ?? "MITTEL",
    },
  });
  return { id: created.id, title: created.title, status: created.status };
}

export async function createPerson(
  tenantId: string,
  data: { firstName: string; lastName: string; email?: string; phone?: string; type?: string },
) {
  const created = await prisma.person.create({
    data: {
      tenantId,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email ?? null,
      phone: data.phone ?? null,
      type: (data.type as "MIETER" | "EIGENTUEMER" | "INTERESSENT" | "HANDWERKER" | "MAKLER" | "BANK" | "SONSTIGE") ?? "SONSTIGE",
    },
  });
  return { id: created.id, firstName: created.firstName, lastName: created.lastName };
}

/** Portfolio-Kennzahlen (für KI/MCP-Überblick). */
export async function portfolioSummary(tenantId: string) {
  const now = new Date();
  const [propertyCount, units, leases, charges, openTickets] = await Promise.all([
    prisma.property.count({ where: { tenantId } }),
    prisma.unit.findMany({ where: { tenantId }, select: { leases: { select: { startDate: true, endDate: true } } } }),
    prisma.lease.findMany({
      where: { tenantId, startDate: { lte: now }, OR: [{ endDate: null }, { endDate: { gte: now } }] },
      include: { components: { select: { amount: true } } },
    }),
    prisma.charge.findMany({ where: { tenantId }, include: { payments: { select: { amount: true } } } }),
    prisma.ticket.count({ where: { tenantId, status: { not: "ERLEDIGT" } } }),
  ]);
  const occupied = units.filter((u) =>
    u.leases.some((l) => l.startDate <= now && (!l.endDate || l.endDate >= now)),
  ).length;
  const monthlyRent = leases.reduce(
    (a, l) => a + Number(l.rentCold) + l.components.reduce((s, c) => s + Number(c.amount), 0),
    0,
  );
  const totalOpen = charges.reduce((a, c) => {
    const open = Number(c.amount) - c.payments.reduce((s, p) => s + Number(p.amount), 0);
    return a + Math.max(0, open);
  }, 0);
  return {
    properties: propertyCount,
    units: units.length,
    occupied,
    vacant: units.length - occupied,
    monthlyRent: Math.round(monthlyRent * 100) / 100,
    openItemsTotal: Math.round(totalOpen * 100) / 100,
    openTickets,
  };
}
