"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/rbac";
import { parseCsv } from "@/lib/csv";
import { personSchema, type ActionState } from "@/lib/schemas";

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
