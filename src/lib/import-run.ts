import "server-only";
import { prisma } from "@/lib/prisma";
import { personSchema, propertySchema, unitSchema } from "@/lib/schemas";
import { normalizeEnum, PROPERTY_TYPE_MAP, MANAGEMENT_MAP, UNIT_TYPE_MAP } from "@/lib/import-columns";

// Geteilte Zeilen-Verarbeitung für CSV-Importe (Auto-Header wie manuelles
// Mapping). `cols` bildet Feld → Spaltenindex (-1 = nicht vorhanden).

export type Cols = Record<string, number>;
export type RunResult = { created: number; skipped: number };

const PERSON_TYPES = ["MIETER", "EIGENTUEMER", "INTERESSENT", "HANDWERKER", "MAKLER", "BANK", "SONSTIGE"];
const at = (r: string[], i: number | undefined) => (i !== undefined && i >= 0 ? r[i] : undefined);

export async function runPersonImport(rows: string[][], cols: Cols, tenantId: string): Promise<RunResult> {
  let created = 0;
  let skipped = 0;
  for (const r of rows.slice(1)) {
    const rawType = (at(r, cols.type) ?? "").toUpperCase();
    const type = PERSON_TYPES.includes(rawType) ? rawType : "SONSTIGE";
    const parsed = personSchema.safeParse({
      firstName: at(r, cols.firstName) ?? "",
      lastName: at(r, cols.lastName) ?? "",
      email: at(r, cols.email),
      phone: at(r, cols.phone),
      type,
      note: at(r, cols.note),
    });
    if (!parsed.success) {
      skipped++;
      continue;
    }
    await prisma.person.create({ data: { ...parsed.data, tenantId } });
    created++;
  }
  return { created, skipped };
}

export async function runPropertyImport(rows: string[][], cols: Cols, tenantId: string): Promise<RunResult> {
  let created = 0;
  let skipped = 0;
  for (const r of rows.slice(1)) {
    const parsed = propertySchema.safeParse({
      name: at(r, cols.name) ?? "",
      street: at(r, cols.street) ?? "",
      zip: at(r, cols.zip) ?? "",
      city: at(r, cols.city) ?? "",
      type: normalizeEnum(at(r, cols.type), PROPERTY_TYPE_MAP, "WOHNEN"),
      management: normalizeEnum(at(r, cols.management), MANAGEMENT_MAP, "MIET"),
      feeType: "PAUSCHAL",
    });
    if (!parsed.success) {
      skipped++;
      continue;
    }
    await prisma.property.create({ data: { ...parsed.data, tenantId } });
    created++;
  }
  return { created, skipped };
}

export async function runUnitImport(rows: string[][], cols: Cols, tenantId: string): Promise<RunResult> {
  const properties = await prisma.property.findMany({
    where: { tenantId },
    select: { id: true, name: true, buildings: { select: { id: true, name: true } } },
  });
  const propByName = new Map(properties.map((p) => [p.name.toLowerCase(), p]));
  const buildingCache = new Map<string, string>();
  for (const p of properties) for (const b of p.buildings) buildingCache.set(`${p.id}|${b.name.toLowerCase()}`, b.id);

  let created = 0;
  let skipped = 0;
  for (const r of rows.slice(1)) {
    const prop = propByName.get((at(r, cols.property) ?? "").trim().toLowerCase());
    if (!prop) {
      skipped++;
      continue;
    }
    const bldName = (at(r, cols.building) || "").trim() || "Haupthaus";
    const cacheKey = `${prop.id}|${bldName.toLowerCase()}`;
    let buildingId = buildingCache.get(cacheKey);
    if (!buildingId) {
      const b = await prisma.building.create({ data: { tenantId, propertyId: prop.id, name: bldName } });
      buildingId = b.id;
      buildingCache.set(cacheKey, buildingId);
    }
    const parsed = unitSchema.safeParse({
      buildingId,
      label: at(r, cols.label) ?? "",
      type: normalizeEnum(at(r, cols.type), UNIT_TYPE_MAP, "WOHNUNG"),
      area: at(r, cols.area) ?? "0",
      rooms: at(r, cols.rooms),
      mea: at(r, cols.mea),
    });
    if (!parsed.success) {
      skipped++;
      continue;
    }
    await prisma.unit.create({ data: { ...parsed.data, tenantId } });
    created++;
  }
  return { created, skipped };
}

export const RUNNERS = {
  person: runPersonImport,
  property: runPropertyImport,
  unit: runUnitImport,
} as const;
