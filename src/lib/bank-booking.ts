import { prisma } from "@/lib/prisma";
import { parseCamt053, type BankEntry } from "@/lib/adapters/bankImport";

// Bankbuchungen übernehmen (camt.053-Datei, REST/MCP, Bank-Sync):
// schon vorhandene Buchungen überspringen und Eingänge nur dann einer offenen
// Sollstellung zuordnen, wenn Betrag UND Zahler passen (#92).

type Booking = { date: string; amount: number; direction: string; reference?: string | null };

const bookingKey = (b: Booking) => [b.date, b.amount.toFixed(2), b.direction, (b.reference ?? "").trim()].join("|");

/**
 * Einträge, die noch nicht gebucht sind. Gleiche Buchungen (Tag, Betrag, Richtung,
 * Verwendungszweck) werden gezählt: stehen zwei gleiche im Auszug und eine ist schon
 * da, kommt nur die zweite dazu. So übersteht ein erneuter oder überlappender Import.
 * ponytail: zwei echte, völlig gleiche Buchungen aus zwei verschiedenen Auszügen gelten
 * als eine; wäre nur mit der Bankreferenz (AcctSvcrRef) sauber trennbar.
 */
export function newBookings<T extends Booking>(entries: T[], existing: Booking[]): T[] {
  const known = new Map<string, number>();
  for (const b of existing) known.set(bookingKey(b), (known.get(bookingKey(b)) ?? 0) + 1);
  const seen = new Map<string, number>();
  return entries.filter((e) => {
    const k = bookingKey(e);
    const n = (seen.get(k) ?? 0) + 1;
    seen.set(k, n);
    return n > (known.get(k) ?? 0);
  });
}

export type Payer = { firstName: string; lastName: string; iban: string | null; accountHolder: string | null };

const norm = (s: string) =>
  s.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFD").replace(/[^a-z0-9 ]/g, "");
const ibanOf = (s: string) => s.replace(/\s/g, "").toUpperCase();

/** Passt die Gegenseite der Bankbuchung zu einem Mieter? IBAN oder Nachname/Kontoinhaber. */
export function payerMatches(p: Payer, counterparty?: string | null, counterpartyIban?: string | null): boolean {
  if (counterpartyIban && p.iban && ibanOf(counterpartyIban) === ibanOf(p.iban)) return true;
  const c = norm(counterparty ?? "");
  if (!c) return false;
  const words = (s: string) => norm(s).split(/\s+/).filter((w) => w.length >= 3);
  const has = (s: string | null) => !!s && words(s).length > 0 && words(s).every((w) => c.includes(w));
  return has(p.accountHolder) || has(p.lastName);
}

export type OpenCharge = { id: string; open: number; payers: Payer[] };

/** Erste offene Sollstellung (älteste Fälligkeit) mit gleichem Betrag und passendem Zahler; wird verbraucht. */
export function takeCharge(
  open: OpenCharge[],
  e: { amount: number; direction: string; counterparty?: string | null; counterpartyIban?: string | null },
): string | null {
  if (e.direction !== "EINGANG") return null;
  const hit = open.find(
    (o) => o.open > 0 && Math.abs(o.open - e.amount) < 0.005 && o.payers.some((p) => payerMatches(p, e.counterparty, e.counterpartyIban)),
  );
  if (!hit) return null;
  hit.open = 0;
  return hit.id;
}

const payerSelect = { select: { firstName: true, lastName: true, iban: true, accountHolder: true } } as const;

export async function openCharges(tenantId: string): Promise<OpenCharge[]> {
  const charges = await prisma.charge.findMany({
    where: { tenantId },
    orderBy: { dueDate: "asc" },
    include: {
      payments: { select: { amount: true } },
      lease: { select: { renters: { select: { person: payerSelect } } } },
      areaAllocation: { select: { person: payerSelect, lease: { select: { renters: { select: { person: payerSelect } } } } } },
    },
  });
  return charges
    .map((c) => ({
      id: c.id,
      open: Number(c.amount) - c.payments.reduce((a, p) => a + Number(p.amount), 0),
      payers: [
        ...(c.lease?.renters.map((r) => r.person) ?? []),
        ...(c.areaAllocation?.person ? [c.areaAllocation.person] : []),
        ...(c.areaAllocation?.lease?.renters.map((r) => r.person) ?? []),
      ],
    }))
    .filter((c) => c.open > 0);
}

/** camt.053-Auszug buchen. Fehler kommen als { error } mit Text für die Oberfläche. */
export async function importCamtStatement(
  tenantId: string,
  accountId: string | null,
  xml: string,
): Promise<{ error: string } | { imported: number; skipped: number; matched: number }> {
  if (accountId && !(await prisma.account.findFirst({ where: { id: accountId, tenantId }, select: { id: true } })))
    return { error: "Konto nicht gefunden" };
  let entries: BankEntry[];
  try {
    entries = parseCamt053(xml);
  } catch {
    return { error: "camt.053 konnte nicht gelesen werden" };
  }
  if (entries.length === 0) return { error: "Keine Buchungen in der Datei" };

  const existing = await prisma.payment.findMany({
    where: { tenantId, accountId, date: { in: [...new Set(entries.map((e) => e.date))].map((d) => new Date(d)) } },
    select: { date: true, amount: true, direction: true, reference: true },
  });
  const fresh = newBookings(
    entries,
    existing.map((p) => ({ date: p.date.toISOString().slice(0, 10), amount: Number(p.amount), direction: p.direction, reference: p.reference })),
  );

  const open = await openCharges(tenantId);
  let matched = 0;
  // ponytail: kein Lock; zwei gleichzeitige Importe derselben Datei können doppeln.
  for (const e of fresh) {
    const chargeId = takeCharge(open, e);
    if (chargeId) matched++;
    await prisma.payment.create({
      data: {
        tenantId, accountId, chargeId, date: new Date(e.date), amount: e.amount, direction: e.direction,
        reference: e.reference, counterparty: e.counterparty, counterpartyIban: e.counterpartyIban,
      },
    });
  }
  return { imported: fresh.length, skipped: entries.length - fresh.length, matched };
}
