import "server-only";
import { prisma } from "@/lib/prisma";
import { threadKey } from "@/lib/inbound";
import { fromInbound, fromOutbound } from "@/lib/mail-attachments";
import { smtpFromAddress } from "@/lib/adapters/mailer";
import { imapAddress } from "@/lib/adapters/imap";

// Unterhaltungen (#43): ein- und ausgehende Mails gruppiert nach Thread-Schlüssel
// (threadId, sonst eigene id). Die Zuordnung passiert beim Import bzw. beim Antworten.

export type ThreadSummary = {
  key: string;
  subject: string;
  counterpart: string;
  count: number;
  lastAt: Date;
  unread: number;
  open: boolean; // mind. eine eingegangene Mail noch nicht erledigt
  hasInbound: boolean;
};

const firstAddress = (s: string) => s.split(/[,;]/)[0]?.trim() ?? "";

export async function listThreads(tenantId: string): Promise<ThreadSummary[]> {
  // ponytail: je 500 neueste Mails gruppiert im Speicher, Paginierung wenn Postfächer größer werden
  const [outbound, inbound, persons] = await Promise.all([
    prisma.emailMessage.findMany({
      where: { tenantId },
      select: { id: true, threadId: true, subject: true, toAddress: true, sentAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.inboundEmail.findMany({
      where: { tenantId },
      select: {
        id: true, threadId: true, subject: true, fromAddress: true, fromName: true, receivedAt: true,
        readAt: true, doneAt: true, person: { select: { firstName: true, lastName: true } },
      },
      orderBy: { receivedAt: "desc" },
      take: 500,
    }),
    prisma.person.findMany({
      where: { tenantId, email: { not: null } },
      select: { email: true, firstName: true, lastName: true },
    }),
  ]);
  const nameByEmail = new Map(persons.map((p) => [p.email!.toLowerCase(), `${p.firstName} ${p.lastName}`]));

  type Item = { key: string; at: Date; subject: string; counterpart: string; inbound?: { read: boolean; done: boolean } };
  const items: Item[] = [
    ...outbound.map((m) => {
      const to = firstAddress(m.toAddress);
      return {
        key: threadKey(m), at: m.sentAt ?? m.createdAt, subject: m.subject,
        counterpart: nameByEmail.get(to.toLowerCase()) ?? to,
      };
    }),
    ...inbound.map((m) => ({
      key: threadKey(m), at: m.receivedAt, subject: m.subject ?? "(ohne Betreff)",
      counterpart: m.person ? `${m.person.firstName} ${m.person.lastName}` : m.fromName || m.fromAddress,
      inbound: { read: !!m.readAt, done: !!m.doneAt },
    })),
  ];

  const threads = new Map<string, ThreadSummary & { firstAt: Date }>();
  for (const it of items) {
    const t = threads.get(it.key);
    if (!t) {
      threads.set(it.key, {
        key: it.key, subject: it.subject, counterpart: it.counterpart, count: 1, lastAt: it.at, firstAt: it.at,
        unread: it.inbound && !it.inbound.read ? 1 : 0, open: !!it.inbound && !it.inbound.done, hasInbound: !!it.inbound,
      });
      continue;
    }
    t.count++;
    if (it.at > t.lastAt) t.lastAt = it.at;
    // Betreff und Gegenüber von der ersten Mail der Unterhaltung
    if (it.at < t.firstAt) Object.assign(t, { firstAt: it.at, subject: it.subject, counterpart: it.counterpart });
    if (it.inbound) {
      t.hasInbound = true;
      if (!it.inbound.read) t.unread++;
      if (!it.inbound.done) t.open = true;
    }
  }
  return [...threads.values()].sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());
}


/** Alle Mails einer Unterhaltung, älteste zuerst. */
export async function loadThread(tenantId: string, key: string) {
  const where = threadWhere(tenantId, key);
  const [outbound, inbound] = await Promise.all([
    prisma.emailMessage.findMany({
      where,
      include: { attachments: { include: { document: { select: { id: true, name: true, mime: true } } } }, sentBy: { select: { name: true } } },
    }),
    prisma.inboundEmail.findMany({ where, include: { attachments: true, person: { select: { id: true, firstName: true, lastName: true } } } }),
  ]);
  return [
    ...outbound.map((m) => ({ dir: "out" as const, at: m.sentAt ?? m.createdAt, ...m, attachments: m.attachments.map(fromOutbound) })),
    ...inbound.map((m) => ({ dir: "in" as const, at: m.receivedAt, ...m, attachments: m.attachments.map(fromInbound) })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** Filter für alle Mails einer Unterhaltung (beide Tabellen). */
export function threadWhere(tenantId: string, key: string) {
  return { tenantId, OR: [{ threadId: key }, { id: key }] };
}

/** „Name <Adresse>“; Adresse mit eigenem Namen bleibt unverändert (#44). */
export function addr(name: string | null | undefined, address: string): string {
  if (!address) return name ?? "";
  return address.includes("<") || !name ? address : `${name} <${address}>`;
}

/** Verwaltung als Absender (SMTP) und Empfänger (IMAP) für die Anzeige (#44). */
export async function ownMailIdentity(tenantId: string) {
  const t = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, smtpFrom: true, smtpUser: true, imapUser: true },
  });
  const name = t?.name ?? "";
  return {
    from: addr(name, smtpFromAddress({ from: t?.smtpFrom, user: t?.smtpUser })),
    inbox: addr(name, imapAddress({ user: t?.imapUser })),
  };
}
