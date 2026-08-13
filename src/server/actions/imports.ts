"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/rbac";
import { parseCsv } from "@/lib/csv";
import { personSchema, propertySchema, type ActionState } from "@/lib/schemas";

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
