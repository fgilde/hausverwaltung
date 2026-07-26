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

const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const propSel = { property: { select: { name: true } } };

export async function listOwners(tenantId: string) {
  const rows = await prisma.owner.findMany({
    where: { tenantId },
    include: {
      person: { select: { firstName: true, lastName: true } },
      unit: { include: { building: { include: { property: { select: { name: true } } } } } },
    },
  });
  return rows.map((o) => ({
    id: o.id,
    person: `${o.person.firstName} ${o.person.lastName}`,
    unit: o.unit.label,
    property: o.unit.building.property.name,
    share: o.share,
  }));
}

export async function listMeters(tenantId: string) {
  const rows = await prisma.meter.findMany({
    where: { tenantId },
    include: {
      unit: { include: { building: { include: { property: { select: { name: true } } } } } },
      readings: { orderBy: { date: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((m) => ({
    id: m.id,
    type: m.type,
    serialNo: m.serialNo,
    unit: m.unit.label,
    property: m.unit.building.property.name,
    lastReading: m.readings[0] ? { date: day(m.readings[0].date), value: num(m.readings[0].value) } : null,
  }));
}

export async function listAccounts(tenantId: string) {
  const rows = await prisma.account.findMany({
    where: { tenantId },
    include: { payments: { select: { amount: true, direction: true } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((a) => {
    const balance = a.payments.reduce(
      (s, p) => s + (p.direction === "EINGANG" ? Number(p.amount) : -Number(p.amount)),
      0,
    );
    return { id: a.id, name: a.name, type: a.type, iban: a.iban, balance: Math.round(balance * 100) / 100 };
  });
}

export async function listCharges(tenantId: string) {
  const rows = await prisma.charge.findMany({
    where: { tenantId },
    include: { payments: { select: { amount: true } }, lease: { include: { unit: { select: { label: true } } } } },
    orderBy: { dueDate: "desc" },
  });
  return rows.map((c) => {
    const paid = c.payments.reduce((s, p) => s + Number(p.amount), 0);
    return {
      id: c.id,
      type: c.type,
      period: day(c.period),
      dueDate: day(c.dueDate),
      amount: num(c.amount),
      paid: Math.round(paid * 100) / 100,
      unit: c.lease?.unit.label ?? null,
    };
  });
}

export async function listPayments(tenantId: string) {
  const rows = await prisma.payment.findMany({
    where: { tenantId },
    include: { account: { select: { name: true } } },
    orderBy: { date: "desc" },
  });
  return rows.map((p) => ({
    id: p.id,
    date: day(p.date),
    amount: num(p.amount),
    direction: p.direction,
    reference: p.reference,
    account: p.account?.name ?? null,
  }));
}

export async function listDocuments(tenantId: string) {
  const rows = await prisma.document.findMany({
    where: { tenantId },
    include: propSel,
    orderBy: { createdAt: "desc" },
  });
  return rows.map((d) => ({
    id: d.id,
    name: d.name,
    category: d.category,
    mime: d.mime,
    size: d.size,
    eInvoice: d.eInvoice,
    invoiceNo: d.invoiceNo,
    invoiceTotal: num(d.invoiceTotal),
    property: d.property?.name ?? null,
    createdAt: day(d.createdAt),
  }));
}

export async function listMeetings(tenantId: string) {
  const rows = await prisma.meeting.findMany({
    where: { tenantId },
    include: { ...propSel, _count: { select: { agendaItems: true, resolutions: true } } },
    orderBy: { date: "desc" },
  });
  return rows.map((m) => ({
    id: m.id,
    title: m.title,
    date: day(m.date),
    status: m.status,
    location: m.location,
    property: m.property.name,
    agendaItems: m._count.agendaItems,
    resolutions: m._count.resolutions,
  }));
}

export async function listResolutions(tenantId: string) {
  const rows = await prisma.resolution.findMany({
    where: { tenantId },
    include: propSel,
    orderBy: [{ propertyId: "asc" }, { number: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    title: r.title,
    text: r.text,
    date: day(r.date),
    result: r.result,
    votes: { yes: r.votesYes, no: r.votesNo, abstain: r.votesAbstain },
    property: r.property.name,
  }));
}

export async function listEconomicPlans(tenantId: string) {
  const rows = await prisma.economicPlan.findMany({
    where: { tenantId },
    include: propSel,
    orderBy: [{ year: "desc" }],
  });
  return rows.map((e) => ({
    id: e.id,
    property: e.property.name,
    year: e.year,
    totalAmount: num(e.totalAmount),
    monthly: Math.round((Number(e.totalAmount) / 12) * 100) / 100,
    note: e.note,
  }));
}

export async function listReserves(tenantId: string) {
  const rows = await prisma.reserve.findMany({
    where: { tenantId },
    include: { ...propSel, transactions: { select: { amount: true } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    property: r.property.name,
    balance: Math.round(r.transactions.reduce((s, t) => s + Number(t.amount), 0) * 100) / 100,
  }));
}

export async function listAppointments(tenantId: string) {
  const rows = await prisma.appointment.findMany({
    where: { tenantId },
    include: propSel,
    orderBy: { start: "asc" },
  });
  return rows.map((a) => ({
    id: a.id,
    title: a.title,
    type: a.type,
    start: a.start.toISOString(),
    end: a.end ? a.end.toISOString() : null,
    location: a.location,
    property: a.property?.name ?? null,
  }));
}

export async function listTasks(tenantId: string) {
  const rows = await prisma.task.findMany({ where: { tenantId }, orderBy: [{ done: "asc" }, { dueDate: "asc" }] });
  return rows.map((t) => ({ id: t.id, title: t.title, dueDate: day(t.dueDate), done: t.done }));
}

export async function listContractors(tenantId: string) {
  const rows = await prisma.contractor.findMany({ where: { tenantId }, orderBy: { name: "asc" } });
  return rows.map((c) => ({ id: c.id, name: c.name, trade: c.trade, email: c.email, phone: c.phone }));
}

export async function listMaintenanceContracts(tenantId: string) {
  const rows = await prisma.maintenanceContract.findMany({
    where: { tenantId },
    include: { ...propSel, contractor: { select: { name: true } } },
    orderBy: { nextDue: "asc" },
  });
  return rows.map((m) => ({
    id: m.id,
    title: m.title,
    intervalMonths: m.intervalMonths,
    nextDue: day(m.nextDue),
    property: m.property.name,
    contractor: m.contractor?.name ?? null,
  }));
}

export async function listInsurances(tenantId: string) {
  const rows = await prisma.insurance.findMany({ where: { tenantId }, include: propSel, orderBy: { createdAt: "asc" } });
  return rows.map((i) => ({
    id: i.id,
    type: i.type,
    insurer: i.insurer,
    policyNo: i.policyNo,
    premium: num(i.premium),
    startDate: day(i.startDate),
    endDate: day(i.endDate),
    property: i.property.name,
  }));
}

export async function listPropertyTaxes(tenantId: string) {
  const rows = await prisma.propertyTax.findMany({ where: { tenantId }, include: propSel });
  return rows.map((p) => {
    const mess = p.messbetrag == null ? null : Number(p.messbetrag);
    const hebe = p.hebesatz == null ? null : Number(p.hebesatz);
    return {
      id: p.id,
      property: p.property.name,
      aktenzeichen: p.aktenzeichen,
      grundsteuerwert: num(p.grundsteuerwert),
      messbetrag: mess,
      hebesatz: hebe,
      jahresbetrag: mess != null && hebe != null ? Math.round(mess * (hebe / 100) * 100) / 100 : null,
    };
  });
}

export async function createTask(tenantId: string, data: { title: string; dueDate?: string }) {
  const created = await prisma.task.create({
    data: { tenantId, title: data.title, dueDate: data.dueDate ? new Date(data.dueDate) : null },
  });
  return { id: created.id, title: created.title };
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
