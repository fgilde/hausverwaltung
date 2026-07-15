"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { isAiConfigured, askAssistant } from "@/lib/ai";

export type AssistantState = { answer?: string; configured?: boolean; error?: string };

/** Baut einen kompakten Bestands-Kontext (nur Kennzahlen, keine PII) für den Assistenten. */
async function buildContext(tenantId: string) {
  const now = new Date();
  const [properties, units, leases, charges, openTickets, dueMaintenance] = await Promise.all([
    prisma.property.findMany({ where: { tenantId }, select: { name: true, city: true, management: true } }),
    prisma.unit.findMany({ where: { tenantId }, select: { leases: { select: { startDate: true, endDate: true } } } }),
    prisma.lease.findMany({
      where: { tenantId, startDate: { lte: now }, OR: [{ endDate: null }, { endDate: { gte: now } }] },
      include: { components: { select: { amount: true } } },
    }),
    prisma.charge.findMany({ where: { tenantId }, include: { payments: { select: { amount: true } } } }),
    prisma.ticket.count({ where: { tenantId, status: { not: "ERLEDIGT" } } }),
    prisma.maintenanceContract.count({ where: { tenantId, nextDue: { lt: now } } }),
  ]);

  const occupied = units.filter((u) =>
    u.leases.some((l) => l.startDate <= now && (!l.endDate || l.endDate >= now)),
  ).length;
  const monthlyRent = leases.reduce(
    (a, l) => a + Number(l.rentCold) + l.components.reduce((s, c) => s + Number(c.amount), 0),
    0,
  );
  let totalOpen = 0;
  let overdue = 0;
  for (const c of charges) {
    const open = Number(c.amount) - c.payments.reduce((a, p) => a + Number(p.amount), 0);
    if (open > 0.001) {
      totalOpen += open;
      if (c.dueDate < now) overdue++;
    }
  }

  return {
    objekte: properties.length,
    einheiten: units.length,
    vermietet: occupied,
    leerstand: units.length - occupied,
    sollmieteMonatlich: Math.round(monthlyRent * 100) / 100,
    offenePostenSumme: Math.round(totalOpen * 100) / 100,
    ueberfaelligeForderungen: overdue,
    offeneTickets: openTickets,
    faelligeWartungen: dueMaintenance,
    objektliste: properties.map((p) => `${p.name} (${p.city}, ${p.management})`),
  };
}

export async function askAssistantAction(_prev: AssistantState, fd: FormData): Promise<AssistantState> {
  const user = await requireUser();
  const question = String(fd.get("question") ?? "").trim();
  if (!question) return { error: "Bitte eine Frage eingeben." };

  const ctx = await buildContext(user.tenantId);
  const tenant = await prisma.tenant.findUnique({
    where: { id: user.tenantId },
    select: { aiApiKey: true, aiModel: true },
  });
  const aiCfg = { apiKey: tenant?.aiApiKey, model: tenant?.aiModel };
  const configured = isAiConfigured(aiCfg);

  if (!configured) {
    // Regelbasierter Fallback ohne LLM: fasst die Kennzahlen zusammen.
    const answer =
      `KI-Assistent nicht konfiguriert (ANTHROPIC_API_KEY fehlt). Kennzahlen zum Bestand:\n` +
      `• ${ctx.objekte} Objekte, ${ctx.einheiten} Einheiten (${ctx.vermietet} vermietet, ${ctx.leerstand} leer)\n` +
      `• Sollmiete/Monat: ${ctx.sollmieteMonatlich} €\n` +
      `• Offene Posten: ${ctx.offenePostenSumme} € (${ctx.ueberfaelligeForderungen} überfällig)\n` +
      `• ${ctx.offeneTickets} offene Tickets, ${ctx.faelligeWartungen} fällige Wartungen`;
    return { answer, configured: false };
  }

  try {
    const answer = await askAssistant(JSON.stringify(ctx), question, aiCfg);
    return { answer, configured: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "KI-Anfrage fehlgeschlagen", configured: true };
  }
}
