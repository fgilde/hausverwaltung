import { prisma } from "@/lib/prisma";
import { isSyncDue } from "@/lib/inbound";
import { syncTenantInbox } from "@/lib/inbound-sync";

// Hintergrund-Job für den automatischen IMAP-Abruf (#39). Läuft im App-Server
// (gestartet über instrumentation.ts) und prüft jede Minute, welche Mandanten
// Auto-Sync aktiv haben und fällig sind. Bewusst simpel gehalten:
// ponytail: ein Prozess, sequentiell; bei mehreren App-Instanzen würde jede
// Instanz syncen (Dedup verhindert Doppel-Mails) — dann auf Job-Queue/Lock umstellen.

const TICK_MS = 60_000;
const g = globalThis as unknown as {
  __havewaInboundTimer?: ReturnType<typeof setInterval>;
  __havewaInboundRunning?: boolean;
  __havewaInboundAttempt?: Map<string, Date>; // letzter (auch fehlgeschlagener) Versuch je Mandant
};
const attempts = (g.__havewaInboundAttempt ??= new Map());

async function tick() {
  if (g.__havewaInboundRunning) return; // kein Überlappen langsamer Läufe
  g.__havewaInboundRunning = true;
  try {
    const tenants = await prisma.tenant.findMany({
      where: { imapAutoSync: true, imapHost: { not: null }, imapUser: { not: null } },
      select: { id: true, lastInboundSyncAt: true, imapSyncIntervalMin: true },
    });
    for (const t of tenants) {
      // Fälligkeit am letzten erfolgreichen Sync ODER letzten Versuch messen: ein
      // kaputtes Postfach wird so nur im Intervall erneut probiert. lastInboundSyncAt
      // bleibt bei Fehlern unverändert, damit beim nächsten Erfolg nichts fehlt.
      const last = [t.lastInboundSyncAt, attempts.get(t.id) ?? null]
        .filter((d): d is Date => !!d)
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
      if (!isSyncDue(last, t.imapSyncIntervalMin)) continue;
      attempts.set(t.id, new Date());
      const res = await syncTenantInbox(t.id);
      if ("error" in res) {
        console.warn(`[inbound] Auto-Sync Mandant ${t.id} fehlgeschlagen: ${res.error}`);
      } else if (res.imported > 0) {
        console.log(`[inbound] Mandant ${t.id}: ${res.imported} neue Mails, ${res.matched} zugeordnet`);
      }
    }
  } catch (e) {
    console.warn("[inbound] Auto-Sync-Lauf fehlgeschlagen:", e instanceof Error ? e.message : e);
  } finally {
    g.__havewaInboundRunning = false;
  }
}

/** Startet den Auto-Sync genau einmal pro Prozess (auch bei Hot-Reload). */
export function startInboundScheduler() {
  if (g.__havewaInboundTimer) return;
  g.__havewaInboundTimer = setInterval(() => void tick(), TICK_MS);
  // Timer soll den Prozess nicht am Beenden hindern.
  g.__havewaInboundTimer.unref?.();
}
