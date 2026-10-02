import { prisma } from "@/lib/prisma";
import { syncTenantBank } from "@/lib/bank-sync";

// Täglicher Bank-Sync (#54). Bewusst höchstens einmal pro Tag je Mandant: der
// Open-Banking-Anbieter begrenzt die Abrufe pro Tag. Prüft stündlich, wer fällig ist.
// ponytail: ein Prozess, sequentiell (wie der IMAP-Job); bei mehreren Instanzen Lock nötig.

const TICK_MS = 60 * 60_000;
export const BANK_SYNC_INTERVAL_MS = 24 * 3600_000;
const g = globalThis as unknown as { __havewaBankTimer?: ReturnType<typeof setInterval>; __havewaBankRunning?: boolean };

/** Fällig, wenn noch nie oder vor mindestens 24 h automatisch synchronisiert. */
export function isBankSyncDue(last: Date | null, now: Date = new Date()): boolean {
  return !last || now.getTime() - last.getTime() >= BANK_SYNC_INTERVAL_MS;
}

async function tick() {
  if (g.__havewaBankRunning) return;
  g.__havewaBankRunning = true;
  try {
    const connectors = await prisma.bankConnector.findMany({ where: { autoSync: true }, select: { tenantId: true, lastAutoSyncAt: true } });
    for (const c of connectors) {
      if (!isBankSyncDue(c.lastAutoSyncAt)) continue;
      // Versuch zählt als Lauf (auch bei Fehlern), damit das Tageslimit nicht durch Wiederholungen aufgebraucht wird.
      await prisma.bankConnector.update({ where: { tenantId: c.tenantId }, data: { lastAutoSyncAt: new Date() } });
      const res = await syncTenantBank(c.tenantId);
      if ("error" in res) console.warn(`[bank] Auto-Sync Mandant ${c.tenantId}: ${res.error}`);
      else {
        if (res.imported) console.log(`[bank] Mandant ${c.tenantId}: ${res.imported} Buchungen, ${res.matched} zugeordnet`);
        if (res.failed.length) console.warn(`[bank] Mandant ${c.tenantId}: ${res.failed.join("; ")}`);
      }
    }
  } catch (e) {
    console.warn("[bank] Auto-Sync-Lauf fehlgeschlagen:", e instanceof Error ? e.message : e);
  } finally {
    g.__havewaBankRunning = false;
  }
}

/** Startet den Bank-Auto-Sync genau einmal pro Prozess (auch bei Hot-Reload). */
export function startBankScheduler() {
  if (g.__havewaBankTimer) return;
  g.__havewaBankTimer = setInterval(() => void tick(), TICK_MS);
  g.__havewaBankTimer.unref?.();
  setTimeout(() => void tick(), 60_000).unref?.(); // erster Lauf kurz nach dem Start
}
