import "server-only";
import { prisma } from "@/lib/prisma";

export type AttachmentDefaults = { personId: string | null; propertyId: string | null; unitId: string | null };

/**
 * Vorbelegung beim Übernehmen eines Mail-Anhangs (#51): Kontakt der Mail und,
 * falls bekannt, Objekt/Einheit aus seinem jüngsten laufenden Mietvertrag,
 * sonst aus seiner (ersten) Eigentumseinheit.
 */
export async function attachmentDefaults(tenantId: string, personIds: (string | null)[]): Promise<Map<string, AttachmentDefaults>> {
  const ids = [...new Set(personIds.filter((x): x is string => !!x))];
  const out = new Map<string, AttachmentDefaults>();
  if (!ids.length) return out;
  const now = new Date();
  const [renters, owners] = await Promise.all([
    prisma.renter.findMany({
      where: { tenantId, personId: { in: ids }, lease: { startDate: { lte: now }, OR: [{ endDate: null }, { endDate: { gte: now } }] } },
      select: { personId: true, lease: { select: { startDate: true, unit: { select: { id: true, building: { select: { propertyId: true } } } } } } },
      orderBy: { lease: { startDate: "desc" } },
    }),
    prisma.owner.findMany({
      where: { tenantId, personId: { in: ids } },
      select: { personId: true, unit: { select: { id: true, building: { select: { propertyId: true } } } } },
      orderBy: { unit: { label: "asc" } },
    }),
  ]);
  for (const id of ids) {
    const unit = renters.find((r) => r.personId === id)?.lease.unit ?? owners.find((o) => o.personId === id)?.unit;
    out.set(id, { personId: id, propertyId: unit?.building.propertyId ?? null, unitId: unit?.id ?? null });
  }
  return out;
}

/** Auswahllisten (Objekt, Einheit, Kontakt) für den Übernehmen-Dialog. */
export async function attachmentImportOptions(tenantId: string) {
  const [properties, units, persons] = await Promise.all([
    prisma.property.findMany({ where: { tenantId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.unit.findMany({
      where: { tenantId },
      orderBy: [{ building: { property: { name: "asc" } } }, { label: "asc" }],
      select: { id: true, label: true, building: { select: { property: { select: { name: true } } } } },
    }),
    prisma.person.findMany({ where: { tenantId }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }], select: { id: true, firstName: true, lastName: true } }),
  ]);
  return {
    properties: properties.map((p) => ({ value: p.id, label: p.name })),
    units: units.map((u) => ({ value: u.id, label: `${u.building.property.name} · ${u.label}` })),
    persons: persons.map((p) => ({ value: p.id, label: `${p.lastName}, ${p.firstName}` })),
  };
}
