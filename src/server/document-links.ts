import "server-only";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { money } from "@/lib/format";
import { DOCUMENT_LINKS, documentLinkData, parseDocumentLink } from "@/lib/document-links";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

/**
 * Formularwert "link" prüfen (#99): Vorgang muss zum Mandanten gehören. Liefert die
 * Spaltenwerte (genau einer gesetzt bzw. alle gelöst) oder einen Fehlertext.
 */
export async function resolveDocumentLink(tenantId: string, raw: FormDataEntryValue | null) {
  const link = parseDocumentLink(raw ? String(raw) : "");
  if (link) {
    const row = await db[DOCUMENT_LINKS[link.kind].model].findFirst({ where: { id: link.id, tenantId }, select: { id: true } });
    if (!row) return { error: "Vorgang nicht gefunden" };
  }
  return { data: documentLinkData(link) };
}

/** Alle Vorgänge als Auswahl, beschriftet nach Art („Mietvertrag: …“, „Ticket: …“ …). */
export async function documentLinkOptions(tenantId: string, locale: string) {
  const t = await getTranslations("documents");
  const [leases, tickets, maintenance, insurances, costs, notes, costType, insType] = await Promise.all([
    prisma.lease.findMany({
      where: { tenantId },
      select: { id: true, startDate: true, unit: { select: { label: true, building: { select: { property: { select: { name: true } } } } } }, renters: { select: { person: { select: { lastName: true } } } } },
      orderBy: { startDate: "desc" },
    }),
    prisma.ticket.findMany({ where: { tenantId }, select: { id: true, title: true }, orderBy: { createdAt: "desc" } }),
    prisma.maintenanceContract.findMany({ where: { tenantId }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
    prisma.insurance.findMany({ where: { tenantId }, select: { id: true, insurer: true, type: true }, orderBy: { insurer: "asc" } }),
    prisma.costEntry.findMany({ where: { tenantId }, select: { id: true, year: true, type: true, amount: true, property: { select: { name: true } } }, orderBy: [{ year: "desc" }, { type: "asc" }] }),
    prisma.note.findMany({ where: { tenantId }, select: { id: true, title: true }, orderBy: { updatedAt: "desc" } }),
    getTranslations("costType"),
    getTranslations("insuranceType"),
  ]);
  return [
    ...leases.map((l) => ({
      value: `lease:${l.id}`,
      label: `${t("linkLease")}: ${l.unit.building.property.name} · ${l.unit.label}${l.renters.length ? ` (${l.renters.map((r) => r.person.lastName).join(", ")})` : ""}`,
    })),
    ...tickets.map((x) => ({ value: `ticket:${x.id}`, label: `${t("linkTicket")}: ${x.title}` })),
    ...maintenance.map((x) => ({ value: `maintenance:${x.id}`, label: `${t("linkMaintenance")}: ${x.title}` })),
    ...insurances.map((x) => ({ value: `insurance:${x.id}`, label: `${t("linkInsurance")}: ${x.insurer} (${insType(x.type)})` })),
    ...costs.map((c) => ({
      value: `cost:${c.id}`,
      label: `${t("linkCost")} ${c.year}: ${c.property.name} · ${costType(c.type)} ${money(Number(c.amount), locale)}`,
    })),
    ...notes.map((n) => ({ value: `note:${n.id}`, label: `${t("linkNote")}: ${n.title}` })),
  ];
}
