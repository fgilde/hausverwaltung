import { createHash } from "node:crypto";
import { parseCamt053, type BankEntry } from "@/lib/adapters/bankImport";
import { prisma } from "@/lib/prisma";

export class CamtImportError extends Error {}

const PREFIX = "camt053:";
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

function bookingKey(date: Date, amount: number, direction: string, reference?: string | null) {
  return JSON.stringify([date.toISOString().slice(0, 10), amount.toFixed(2), direction, reference?.trim() || ""]);
}

function paymentRows(entries: BankEntry[], tenantId: string, accountId: string) {
  const occurrences = new Map<string, number>();
  const fileKey = entries.some((entry) => !entry.bankReference && !entry.statementId) ? digest(entries) : null;
  return entries.map(({ date, amount, direction, reference, counterparty, counterpartyIban, bankReference, statementId }) => {
    // A reference identifies a bank entry across overlapping statements. Without one,
    // scope the fingerprint to the statement (or to the parsed file if there is no ID).
    const key = bankReference
      ? JSON.stringify([accountId, bankReference, date, amount.toFixed(2), direction])
      : JSON.stringify([accountId, statementId || fileKey, date, amount.toFixed(2), direction, reference, counterparty, counterpartyIban]);
    const occurrence = (occurrences.get(key) ?? 0) + 1;
    occurrences.set(key, occurrence);
    return {
      tenantId, accountId, date: new Date(date), amount, direction, reference, counterparty, counterpartyIban,
      externalId: PREFIX + (bankReference ? "entry:" : "statement:") + digest([key, occurrence]),
      chargeId: null,
    };
  });
}

export async function importCamtStatement(tenantId: string, accountId: string, xml: string) {
  if (!accountId) throw new CamtImportError("Bitte wählen Sie das Konto des Kontoauszugs aus.");
  const account = await prisma.account.findFirst({
    where: { tenantId, id: accountId },
    select: { iban: true },
  });
  if (!account) throw new CamtImportError("Konto nicht gefunden");

  let entries;
  try {
    entries = parseCamt053(xml);
  } catch {
    throw new CamtImportError("camt.053 konnte nicht gelesen werden");
  }
  if (!entries.length) throw new CamtImportError("Keine Buchungen in der Datei");
  const ibans = new Set(entries.flatMap((entry) => entry.accountIban ? [entry.accountIban] : []));
  const targetIban = account.iban?.replace(/\s/g, "").toUpperCase();
  if (ibans.size > 1 || (ibans.size > 0 && (!targetIban || !ibans.has(targetIban)))) {
    throw new CamtImportError("Die IBAN im Kontoauszug passt nicht zum ausgewählten Konto.");
  }

  const rows = paymentRows(entries, tenantId, accountId);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.payment.findMany({
      where: {
        tenantId,
        OR: [{ accountId }, { accountId: null, externalId: null }],
        date: { in: [...new Set(entries.map((entry) => entry.date))].map((day) => new Date(day)) },
      },
      select: { date: true, amount: true, direction: true, reference: true, externalId: true },
    });
    const ids = new Set(rows.map((row) => row.externalId));
    const known = new Set(existing.map((row) => row.externalId));
    const otherBookings = new Map<string, boolean>(); // value: at least one booking has no comparable bank ID
    for (const row of existing) {
      if (row.externalId && ids.has(row.externalId)) continue;
      const key = bookingKey(row.date, Number(row.amount), row.direction, row.reference);
      otherBookings.set(key, Boolean(otherBookings.get(key) || !row.externalId?.startsWith(PREFIX + "entry:")));
    }
    // Legacy and other imports have no comparable IDs. When the visible booking
    // data agrees, require reconciliation instead of silently merging or duplicating it.
    for (const row of rows) {
      if (known.has(row.externalId)) continue;
      const possibleDuplicate = otherBookings.get(bookingKey(row.date, row.amount, row.direction, row.reference));
      if (possibleDuplicate !== undefined && (possibleDuplicate || row.externalId.startsWith(PREFIX + "statement:"))) {
        throw new CamtImportError("Mögliches Duplikat in vorhandenen Kontobewegungen. Bitte prüfen Sie die Buchungen vor dem Import.");
      }
    }
    // The unique constraint also covers concurrent retries of the same statement.
    const { count } = await tx.payment.createMany({ data: rows, skipDuplicates: true });
    return { imported: count, skipped: rows.length - count, matched: 0 };
  });
}
