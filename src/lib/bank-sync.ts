import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import * as eb from "@/lib/adapters/enablebanking";

// Bank-Sync ohne Auth-Bezug: genutzt von „Konten synchronisieren“ (manuell) und
// vom täglichen Hintergrund-Job (#54).

export type BankSyncResult = { imported: number; matched: number; failed: string[] };

export async function bankConnector(tenantId: string): Promise<eb.Connector | null> {
  const c = await prisma.bankConnector.findUnique({ where: { tenantId } });
  if (!c) return null;
  return { applicationId: c.applicationId, privateKeyPem: decryptSecret(c.privateKeyEnc), baseUrl: c.baseUrl ?? undefined };
}

/** Transaktionen einer Verknüpfung abrufen, als Zahlungen buchen, offene Posten zuordnen. */
export async function syncLink(tenantId: string, linkId: string, conn: eb.Connector) {
  const link = await prisma.bankLink.findFirst({ where: { id: linkId, tenantId } });
  if (!link) throw new Error("Verknüpfung nicht gefunden");
  const from = link.lastSyncAt ?? new Date(Date.now() - 90 * 86_400_000);
  const raw = await eb.getTransactions(conn, link.accountUid, from.toISOString().slice(0, 10));

  // Offene Sollstellungen für Auto-Zuordnung (wie camt.053-Import).
  const charges = await prisma.charge.findMany({ where: { tenantId }, include: { payments: { select: { amount: true } } } });
  const openMap = charges.map((c) => ({ id: c.id, open: Number(c.amount) - c.payments.reduce((a, p) => a + Number(p.amount), 0) }));

  let imported = 0;
  let matched = 0;
  for (const t of raw) {
    const m = eb.mapTransaction(t);
    if (!m.externalId || !m.date || m.amount <= 0) continue;
    // Dedup: bereits importierte externe Transaktion überspringen (Gegenseite ggf. nachtragen, #60).
    const known = await prisma.payment.findFirst({ where: { tenantId, externalId: m.externalId }, select: { id: true, counterparty: true } });
    if (known) {
      if (!known.counterparty && m.counterparty) {
        await prisma.payment.update({ where: { id: known.id }, data: { counterparty: m.counterparty, counterpartyIban: m.counterpartyIban } });
      }
      continue;
    }
    let chargeId: string | null = null;
    if (m.direction === "EINGANG") {
      const hit = openMap.find((o) => o.open > 0 && Math.abs(o.open - m.amount) < 0.005);
      if (hit) {
        chargeId = hit.id;
        hit.open = 0;
        matched++;
      }
    }
    await prisma.payment.create({
      data: {
        tenantId, accountId: link.accountId, chargeId, date: new Date(m.date), amount: m.amount,
        direction: m.direction, reference: m.reference, externalId: m.externalId,
        counterparty: m.counterparty, counterpartyIban: m.counterpartyIban,
      },
    });
    imported++;
  }
  await prisma.bankLink.update({ where: { id: link.id }, data: { lastSyncAt: new Date() } });
  // Kontostand laut Bank (#57); manche Banken liefern keine Salden, dann bleibt der alte Wert.
  try {
    const bal = eb.pickBalance(await eb.getBalances(conn, link.accountUid));
    if (bal) {
      await prisma.account.update({
        where: { id: link.accountId },
        data: { balance: bal.amount, balanceAt: bal.date ? new Date(bal.date) : new Date() },
      });
    }
  } catch (e) {
    console.warn(`[bank] Kontostand ${link.id}: ${e instanceof Error ? e.message : e}`);
  }
  return { imported, matched };
}

/** Alle verbundenen Konten eines Mandanten synchronisieren; Fehler je Konto sammeln. */
export async function syncTenantBank(tenantId: string): Promise<BankSyncResult | { error: string }> {
  let conn: eb.Connector | null;
  try {
    conn = await bankConnector(tenantId);
  } catch {
    return { error: "Bank-Connector-Schlüssel ungültig, bitte in den Einstellungen neu hinterlegen" };
  }
  if (!conn) return { error: "Kein Bank-Connector konfiguriert" };
  const links = await prisma.bankLink.findMany({ where: { tenantId }, include: { account: { select: { name: true } } } });
  const res: BankSyncResult = { imported: 0, matched: 0, failed: [] };
  for (const l of links) {
    if (l.consentValidUntil && l.consentValidUntil < new Date()) {
      res.failed.push(`${l.account.name}: Freigabe abgelaufen`);
      continue;
    }
    try {
      const r = await syncLink(tenantId, l.id, conn);
      res.imported += r.imported;
      res.matched += r.matched;
    } catch (e) {
      res.failed.push(`${l.account.name}: ${e instanceof Error ? e.message : "Abruf fehlgeschlagen"}`);
    }
  }
  return res;
}
