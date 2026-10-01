import { prisma } from "@/lib/prisma";
import { fetchInbox, isImapConfigured, type FetchedMail } from "@/lib/adapters/imap";
import { dedupKey, matchPersonId, clampAttachMaxMb, isReplySubject, normalizeSubject, threadKey } from "@/lib/inbound";
import { saveFile } from "@/lib/storage";

export type InboundSyncResult = { imported: number; matched: number } | { error: string };

/**
 * Unterhaltung einer eingehenden Mail finden (#43): zuerst über die Message-IDs
 * aus In-Reply-To/References, sonst über den Betreff einer Antwort („Re: …“)
 * an bzw. von derselben Adresse. null = neue Unterhaltung.
 */
export async function findThread(tenantId: string, m: FetchedMail): Promise<string | null> {
  if (m.references.length) {
    const out = await prisma.emailMessage.findFirst({
      where: { tenantId, messageId: { in: m.references } },
      select: { id: true, threadId: true },
      orderBy: { createdAt: "desc" },
    });
    if (out) return threadKey(out);
    const inb = await prisma.inboundEmail.findFirst({
      where: { tenantId, messageId: { in: m.references } },
      select: { id: true, threadId: true },
      orderBy: { receivedAt: "desc" },
    });
    if (inb) return threadKey(inb);
  }
  // Fallback für Mailprogramme ohne Header: nur bei Antwort-Betreff, 180 Tage zurück.
  if (!isReplySubject(m.subject)) return null;
  const subject = normalizeSubject(m.subject);
  const since = new Date(m.receivedAt.getTime() - 180 * 24 * 3600 * 1000);
  const outs = await prisma.emailMessage.findMany({
    where: { tenantId, status: "GESENDET", toAddress: { contains: m.fromAddress, mode: "insensitive" }, createdAt: { gte: since } },
    select: { id: true, threadId: true, subject: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const hitOut = outs.find((o) => normalizeSubject(o.subject) === subject);
  if (hitOut) return threadKey(hitOut);
  const ins = await prisma.inboundEmail.findMany({
    where: { tenantId, fromAddress: { equals: m.fromAddress, mode: "insensitive" }, receivedAt: { gte: since } },
    select: { id: true, threadId: true, subject: true },
    orderBy: { receivedAt: "desc" },
    take: 50,
  });
  const hitIn = ins.find((i) => normalizeSubject(i.subject) === subject);
  return hitIn ? threadKey(hitIn) : null;
}

/**
 * Ruft das IMAP-Postfach eines Mandanten ab und legt neue Mails als InboundEmail
 * an (Dedup über Message-ID), ordnet Absender Personen zu und setzt
 * lastInboundSyncAt. Gemeinsam genutzt vom manuellen Button und vom Auto-Sync.
 * Ohne Server-/Auth-Bezug, damit auch der Hintergrund-Job ihn aufrufen kann.
 */
export async function syncTenantInbox(tenantId: string): Promise<InboundSyncResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { imapHost: true, imapPort: true, imapUser: true, imapPassword: true, imapSecure: true, imapMailbox: true, lastInboundSyncAt: true, imapAttachments: true, imapAttachMaxMb: true },
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
    mails = await fetchInbox(cfg, since, {
      attachMaxBytes: tenant?.imapAttachments ? clampAttachMaxMb(tenant.imapAttachMaxMb) * 1024 * 1024 : 0,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "IMAP-Abruf fehlgeschlagen" };
  }

  const persons = await prisma.person.findMany({
    where: { tenantId, email: { not: null } },
    select: { id: true, email: true },
  });

  let imported = 0;
  let matched = 0;
  // Älteste zuerst, damit Antworten im selben Abruf ihren Vorgänger schon finden.
  for (const m of [...mails].reverse()) {
    const key = dedupKey(m);
    const exists = await prisma.inboundEmail.findUnique({
      where: { tenantId_messageId: { tenantId, messageId: key } },
      select: { id: true },
    });
    if (exists) continue;
    const personId = matchPersonId(m.fromAddress, persons);
    if (personId) matched++;
    const mail = await prisma.inboundEmail.create({
      data: {
        tenantId,
        messageId: key,
        fromAddress: m.fromAddress,
        fromName: m.fromName,
        subject: m.subject,
        body: m.body,
        receivedAt: m.receivedAt,
        personId,
        references: m.references.join(" ") || null,
        threadId: await findThread(tenantId, m),
      },
      select: { id: true },
    });
    // Anhänge aller Absender zunächst nur an der Mail ablegen (#52); in die
    // Dokumentenablage kommen sie erst per „Übernehmen“. Größe/Anzahl begrenzt.
    for (const a of m.attachments) {
      const storageKey = await saveFile(a.content, a.filename);
      await prisma.inboundEmailAttachment.create({
        data: { inboundEmailId: mail.id, name: a.filename, mime: a.contentType, size: a.size, storageKey },
      });
    }
    imported++;
  }

  await prisma.tenant.update({ where: { id: tenantId }, data: { lastInboundSyncAt: new Date() } });
  return { imported, matched };
}
