"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/rbac";
import { parseCsv } from "@/lib/csv";
import { missingRequired } from "@/lib/import-columns";
import { RUNNERS } from "@/lib/import-run";
import type { ActionState } from "@/lib/schemas";

export type ImportState = ActionState & { created?: number; skipped?: number };

const ENTITIES = ["person", "property", "unit"] as const;
type Entity = (typeof ENTITIES)[number];
const isEntity = (v: string): v is Entity => (ENTITIES as readonly string[]).includes(v);

// Mapping (Feld -> Spaltenindex) aus JSON robust einlesen.
function parseMapping(raw: string): Record<string, number> {
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(obj)) {
      const n = Number(v);
      out[k] = Number.isInteger(n) ? n : -1;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * CSV-Import mit explizitem Spalten-Mapping (Mapping-Assistent, #33). Das Mapping
 * bildet Zielfeld → CSV-Spaltenindex; Pflichtfelder müssen zugeordnet sein.
 */
export async function importMapped(_prev: ImportState, fd: FormData): Promise<ImportState> {
  const user = await requireWriter();
  const entity = String(fd.get("entity") ?? "");
  if (!isEntity(entity)) return { error: "Unbekannter Typ" };

  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Keine Datei" };

  const cols = parseMapping(String(fd.get("mapping") ?? "{}"));
  const missing = missingRequired(entity, cols);
  if (missing.length) return { error: `Pflichtfelder nicht zugeordnet: ${missing.join(", ")}` };

  const rows = parseCsv(await file.text());
  if (rows.length < 2) return { error: "Keine Datenzeilen gefunden" };

  const { created, skipped } = await RUNNERS[entity](rows, cols, user.tenantId);
  revalidatePath("/", "layout");
  return { ok: true, created, skipped };
}

// --- Mapping-Vorlagen (Presets) ---

export async function saveImportPreset(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const entity = String(fd.get("entity") ?? "");
  const name = String(fd.get("name") ?? "").trim();
  if (!isEntity(entity)) return { error: "Unbekannter Typ" };
  if (!name) return { error: "Name erforderlich" };
  const mapping = parseMapping(String(fd.get("mapping") ?? "{}"));

  await prisma.importPreset.create({
    data: { tenantId: user.tenantId, entity, name, mapping },
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteImportPreset(fd: FormData): Promise<void> {
  const user = await requireWriter();
  await prisma.importPreset.deleteMany({ where: { id: String(fd.get("id") ?? ""), tenantId: user.tenantId } });
  revalidatePath("/", "layout");
}
