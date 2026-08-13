import type { PrismaClient } from "@prisma/client";

// Standard-Kontenrahmen für die Hausverwaltung — damit man nicht jedes Konto
// selbst anlegen muss. Bewusst schlank (kein SKR03/04), pro Mandant einmalig.
export const DEFAULT_ACCOUNTS = [
  { name: "Girokonto", type: "BANK" },
  { name: "Kautionskonto", type: "KAUTION" },
  { name: "Instandhaltungsrücklage", type: "RUECKLAGE" },
  { name: "Mieteinnahmen", type: "SACHKONTO" },
  { name: "Betriebskosten", type: "SACHKONTO" },
  { name: "Instandhaltung", type: "SACHKONTO" },
  { name: "Verwaltungskosten", type: "SACHKONTO" },
] as const;

type AccountClient = Pick<PrismaClient, "account">;

/** Legt den Standard-Kontenrahmen an, aber nur wenn der Mandant noch keine
 *  Konten hat (idempotent). Gibt die Anzahl neu angelegter Konten zurück. */
export async function ensureDefaultAccounts(db: AccountClient, tenantId: string): Promise<number> {
  const count = await db.account.count({ where: { tenantId } });
  if (count > 0) return 0;
  await db.account.createMany({
    data: DEFAULT_ACCOUNTS.map((a) => ({ name: a.name, type: a.type, tenantId })),
  });
  return DEFAULT_ACCOUNTS.length;
}
