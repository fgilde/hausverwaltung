import { prisma } from "@/lib/prisma";
import { fetchInbox, isImapConfigured } from "@/lib/adapters/imap";
import { dedupKey, matchPersonId } from "@/lib/inbound";

export type InboundSyncResult = { imported: number; matched: number } | { error: string };

/**
 * Ruft das IMAP-Postfach eines Mandanten ab und legt neue Mails als InboundEmail
 * an (Dedup über Message-ID), ordnet Absender Personen zu und setzt
 * lastInboundSyncAt. Gemeinsam genutzt vom manuellen Button und vom Auto-Sync.
 * Ohne Server-/Auth-Bezug, damit auch der Hintergrund-Job ihn aufrufen kann.
 */
export async function syncTenantInbox(tenantId: string): Promise<InboundSyncResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { imapHost: true, imapPort: true, imapUser: true, imapPassword: true, imapSecure: true, imapMailbox: true, lastInboundSyncAt: true },
  });
  const cfg = {
    host: tenant?.imapHost, port: tenant?.imapPort, user: tenant?.imapUser,
    password: tenant?.imapPassword, secure: tenant?.imapSecure, mailbox: tenant?.imapMailbox,
  };
  if (!isImapConfigured(cfg)) return { error: "Kein IMAP-Postfach konfiguriert (Einstellungen → E-Mail)." };

  // Etwas Überlappung zum letzten Sync, damit nichts verloren geht (Dedup fängt Doppelte).
  const since = tenant?.lastInboundSyncAt
    ? new Date(tenant.lastInboundSyncAt.getTime() - 24 * 3600 * 1000)
    : new Date(Date.now() - 90 * 24 * 3600 * 1000);

  let mails;
  try {
    mails = await fetchInbox(cfg, since);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "IMAP-Abruf fehlgeschlagen" };
  }

  const persons = await prisma.person.findMany({
    where: { tenantId, email: { not: null } },
    select: { id: true, email: true },
  });

  let imported = 0;
  let matched = 0;
  for (const m of mails) {
    const key = dedupKey(m);
    const exists = await prisma.inboundEmail.findUnique({
      where: { tenantId_messageId: { tenantId, messageId: key } },
      select: { id: true },
    });
    if (exists) continue;
    const personId = matchPersonId(m.fromAddress, persons);
    if (personId) matched++;
    await prisma.inboundEmail.create({
      data: {
        tenantId,
        messageId: key,
        fromAddress: m.fromAddress,
        fromName: m.fromName,
        subject: m.subject,
        body: m.body,
        receivedAt: m.receivedAt,
        personId,
      },
    });
    imported++;
  }

  await prisma.tenant.update({ where: { id: tenantId }, data: { lastInboundSyncAt: new Date() } });
  return { imported, matched };
}
