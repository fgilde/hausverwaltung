"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/rbac";
import { parseCsv } from "@/lib/csv";
import { personSchema, propertySchema, unitSchema, type ActionState } from "@/lib/schemas";
import {
  mapColumns,
  normalizeEnum,
  PERSON_COLS,
  PROPERTY_COLS,
  UNIT_COLS,
  PROPERTY_TYPE_MAP,
  MANAGEMENT_MAP,
  UNIT_TYPE_MAP,
} from "@/lib/import-columns";

export type ImportState = ActionState & { created?: number; skipped?: number };

const PERSON_TYPES = ["MIETER", "EIGENTUEMER", "INTERESSENT", "HANDWERKER", "MAKLER", "BANK", "SONSTIGE"];

/**
 * Personen (Adressbuch) aus CSV importieren. Spalten per Header zugeordnet
 * (deutsch oder englisch, siehe import-columns); Vor-/Nachname Pflicht.
 * Ungültige Zeilen werden übersprungen, nicht abgebrochen.
 */
export async function importPersons(_prev: ImportState, fd: FormData): Promise<ImportState> {
  const user = await requireWriter();
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Keine Datei" };

  const rows = parseCsv(await file.text());
  if (rows.length < 2) return { error: "Keine Datenzeilen gefunden" };

  const c = mapColumns(rows[0], PERSON_COLS);
  if (c.firstName < 0 || c.lastName < 0) return { error: "Spalten Vorname/firstName und Nachname/lastName erforderlich" };
  const at = (r: string[], i: number) => (i >= 0 ? r[i] : undefined);

  let created = 0;
  let skipped = 0;
  for (const r of rows.slice(1)) {
    const rawType = (at(r, c.type) ?? "").toUpperCase();
    const type = PERSON_TYPES.includes(rawType) ? rawType : "SONSTIGE";
    const parsed = personSchema.safeParse({
      firstName: r[c.firstName] ?? "",
      lastName: r[c.lastName] ?? "",
      email: at(r, c.email),
      phone: at(r, c.phone),
      type,
      note: at(r, c.note),
    });
    if (!parsed.success) {
      skipped++;
      continue;
    }
    await prisma.person.create({ data: { ...parsed.data, tenantId: user.tenantId } });
    created++;
  }
  revalidatePath("/", "layout");
  return { ok: true, created, skipped };
}

/**
 * Objekte aus CSV importieren. Spalten: name, street, zip, city (Pflicht),
 * optional type (Wohnen/Gewerbe/Gemischt), management (Miet/WEG) — deutsch oder
 * englisch. Ungültige Zeilen werden übersprungen.
 */
export async function importProperties(_prev: ImportState, fd: FormData): Promise<ImportState> {
  const user = await requireWriter();
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Keine Datei" };

  const rows = parseCsv(await file.text());
  if (rows.length < 2) return { error: "Keine Datenzeilen gefunden" };
  const c = mapColumns(rows[0], PROPERTY_COLS);
  if (c.name < 0 || c.street < 0 || c.zip < 0 || c.city < 0)
    return { error: "Spalten Name, Straße/street, PLZ/zip, Ort/city erforderlich" };
  const at = (r: string[], i: number) => (i >= 0 ? r[i] : undefined);

  let created = 0;
  let skipped = 0;
  for (const r of rows.slice(1)) {
    const parsed = propertySchema.safeParse({
      name: r[c.name] ?? "",
      street: r[c.street] ?? "",
      zip: r[c.zip] ?? "",
      city: r[c.city] ?? "",
      type: normalizeEnum(at(r, c.type), PROPERTY_TYPE_MAP, "WOHNEN"),
      management: normalizeEnum(at(r, c.management), MANAGEMENT_MAP, "MIET"),
      feeType: "PAUSCHAL",
    });
    if (!parsed.success) {
      skipped++;
      continue;
    }
    await prisma.property.create({ data: { ...parsed.data, tenantId: user.tenantId } });
    created++;
  }
  revalidatePath("/", "layout");
  return { ok: true, created, skipped };
}

/**
 * Einheiten aus CSV importieren. Spalten: property/Objekt, building/Gebäude,
 * label/Bezeichnung (Pflicht: Objekt + Bezeichnung), optional type, area, rooms,
 * mea — deutsch oder englisch. Objekt wird per Name aufgelöst (muss existieren),
 * Gebäude per Name im Objekt (wird bei Bedarf angelegt).
 */
export async function importUnits(_prev: ImportState, fd: FormData): Promise<ImportState> {
  const user = await requireWriter();
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Keine Datei" };

  const rows = parseCsv(await file.text());
  if (rows.length < 2) return { error: "Keine Datenzeilen gefunden" };
  const c = mapColumns(rows[0], UNIT_COLS);
  if (c.property < 0 || c.label < 0) return { error: "Spalten Objekt/property und Bezeichnung/label erforderlich" };
  const at = (r: string[], i: number) => (i >= 0 ? r[i] : undefined);

  // Objekte + vorhandene Gebäude des Mandanten cachen.
  const properties = await prisma.property.findMany({
    where: { tenantId: user.tenantId },
    select: { id: true, name: true, buildings: { select: { id: true, name: true } } },
  });
  const propByName = new Map(properties.map((p) => [p.name.toLowerCase(), p]));
  const buildingCache = new Map<string, string>(); // key propId|bldName → buildingId
  for (const p of properties) for (const b of p.buildings) buildingCache.set(`${p.id}|${b.name.toLowerCase()}`, b.id);

  let created = 0;
  let skipped = 0;
  for (const r of rows.slice(1)) {
    const prop = propByName.get((r[c.property] ?? "").trim().toLowerCase());
    if (!prop) {
      skipped++;
      continue;
    }
    const bldName = (at(r, c.building) || "").trim() || "Haupthaus";
    const cacheKey = `${prop.id}|${bldName.toLowerCase()}`;
    let buildingId = buildingCache.get(cacheKey);
    if (!buildingId) {
      const b = await prisma.building.create({ data: { tenantId: user.tenantId, propertyId: prop.id, name: bldName } });
      buildingId = b.id;
      buildingCache.set(cacheKey, buildingId);
    }
    const parsed = unitSchema.safeParse({
      buildingId,
      label: r[c.label] ?? "",
      type: normalizeEnum(at(r, c.type), UNIT_TYPE_MAP, "WOHNUNG"),
      area: at(r, c.area) ?? "0",
      rooms: at(r, c.rooms),
      mea: at(r, c.mea),
    });
    if (!parsed.success) {
      skipped++;
      continue;
    }
    await prisma.unit.create({ data: { ...parsed.data, tenantId: user.tenantId } });
    created++;
  }
  revalidatePath("/", "layout");
  return { ok: true, created, skipped };
}
