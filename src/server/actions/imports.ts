"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/rbac";
import { parseCsv } from "@/lib/csv";
import { personSchema, propertySchema, unitSchema, type ActionState } from "@/lib/schemas";

export type ImportState = ActionState & { created?: number; skipped?: number };

const PERSON_TYPES = ["MIETER", "EIGENTUEMER", "INTERESSENT", "HANDWERKER", "MAKLER", "BANK", "SONSTIGE"];

/**
 * Personen (Adressbuch) aus CSV importieren. Spalten per Header zugeordnet
 * (firstName, lastName, email, phone, type, note); firstName+lastName Pflicht.
 * Ungültige Zeilen werden übersprungen, nicht abgebrochen.
 */
export async function importPersons(_prev: ImportState, fd: FormData): Promise<ImportState> {
  const user = await requireWriter();
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Keine Datei" };

  const rows = parseCsv(await file.text());
  if (rows.length < 2) return { error: "Keine Datenzeilen gefunden" };

  const header = rows[0].map((h) => h.toLowerCase());
  const col = (name: string) => header.indexOf(name.toLowerCase());
  const fi = col("firstName");
  const li = col("lastName");
  if (fi < 0 || li < 0) return { error: "Spalten 'firstName' und 'lastName' erforderlich" };
  const ei = col("email");
  const pi = col("phone");
  const ti = col("type");
  const ni = col("note");

  let created = 0;
  let skipped = 0;
  for (const r of rows.slice(1)) {
    const type = ti >= 0 && PERSON_TYPES.includes((r[ti] ?? "").toUpperCase()) ? r[ti].toUpperCase() : "SONSTIGE";
    const parsed = personSchema.safeParse({
      firstName: r[fi] ?? "",
      lastName: r[li] ?? "",
      email: ei >= 0 ? r[ei] : undefined,
      phone: pi >= 0 ? r[pi] : undefined,
      type,
      note: ni >= 0 ? r[ni] : undefined,
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

const PROPERTY_TYPES = ["WOHNEN", "GEWERBE", "GEMISCHT"];
const MANAGEMENT_TYPES = ["MIET", "WEG"];
const pick = <T extends string>(v: string | undefined, allowed: T[], fallback: T): T =>
  v && allowed.includes(v.toUpperCase() as T) ? (v.toUpperCase() as T) : fallback;

/**
 * Objekte aus CSV importieren. Spalten: name, street, zip, city (Pflicht),
 * optional type (WOHNEN/GEWERBE/GEMISCHT), management (MIET/WEG). Ungültige
 * Zeilen werden übersprungen.
 */
export async function importProperties(_prev: ImportState, fd: FormData): Promise<ImportState> {
  const user = await requireWriter();
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Keine Datei" };

  const rows = parseCsv(await file.text());
  if (rows.length < 2) return { error: "Keine Datenzeilen gefunden" };
  const header = rows[0].map((h) => h.toLowerCase());
  const col = (name: string) => header.indexOf(name.toLowerCase());
  const ni = col("name");
  const si = col("street");
  const zi = col("zip");
  const ci = col("city");
  if (ni < 0 || si < 0 || zi < 0 || ci < 0) return { error: "Spalten name, street, zip, city erforderlich" };
  const tyi = col("type");
  const mi = col("management");

  let created = 0;
  let skipped = 0;
  for (const r of rows.slice(1)) {
    const parsed = propertySchema.safeParse({
      name: r[ni] ?? "",
      street: r[si] ?? "",
      zip: r[zi] ?? "",
      city: r[ci] ?? "",
      type: pick(tyi >= 0 ? r[tyi] : undefined, PROPERTY_TYPES, "WOHNEN"),
      management: pick(mi >= 0 ? r[mi] : undefined, MANAGEMENT_TYPES, "MIET"),
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

const UNIT_TYPES = ["WOHNUNG", "GEWERBE", "STELLPLATZ", "KELLER", "SONSTIGES"];

/**
 * Einheiten aus CSV importieren. Spalten: property, building, label (Pflicht),
 * optional type, area, rooms, mea. Objekt wird per Name aufgelöst (muss
 * existieren), Gebäude per Name im Objekt (wird bei Bedarf angelegt).
 */
export async function importUnits(_prev: ImportState, fd: FormData): Promise<ImportState> {
  const user = await requireWriter();
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Keine Datei" };

  const rows = parseCsv(await file.text());
  if (rows.length < 2) return { error: "Keine Datenzeilen gefunden" };
  const header = rows[0].map((h) => h.toLowerCase());
  const col = (name: string) => header.indexOf(name.toLowerCase());
  const pi = col("property");
  const bi = col("building");
  const li = col("label");
  if (pi < 0 || li < 0) return { error: "Spalten 'property' und 'label' erforderlich" };
  const tyi = col("type");
  const ai = col("area");
  const ri = col("rooms");
  const mi = col("mea");

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
    const prop = propByName.get((r[pi] ?? "").toLowerCase());
    if (!prop) {
      skipped++;
      continue;
    }
    const bldName = (bi >= 0 ? r[bi] : "") || "Haupthaus";
    const cacheKey = `${prop.id}|${bldName.toLowerCase()}`;
    let buildingId = buildingCache.get(cacheKey);
    if (!buildingId) {
      const b = await prisma.building.create({ data: { tenantId: user.tenantId, propertyId: prop.id, name: bldName } });
      buildingId = b.id;
      buildingCache.set(cacheKey, buildingId);
    }
    const type = tyi >= 0 && UNIT_TYPES.includes((r[tyi] ?? "").toUpperCase()) ? r[tyi].toUpperCase() : "WOHNUNG";
    const parsed = unitSchema.safeParse({
      buildingId,
      label: r[li] ?? "",
      type,
      area: ai >= 0 ? r[ai] : "0",
      rooms: ri >= 0 ? r[ri] : undefined,
      mea: mi >= 0 ? r[mi] : undefined,
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
