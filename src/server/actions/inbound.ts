"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { fetchInbox, isImapConfigured } from "@/lib/adapters/imap";
import { dedupKey, matchPersonId } from "@/lib/inbound";
import type { ActionState } from "@/lib/schemas";

/**
 * Ruft eingehende Mails per IMAP ab und legt neue als InboundEmail an (dedupliziert
 * über die Message-ID), ordnet sie per Absenderadresse einer Person zu und merkt
 * sich den Zeitpunkt des letzten Abrufs. Nur neue Nachrichten seit dem letzten Sync.
 */
export async function syncInbox(_p: ActionState, _fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const tenant = await prisma.tenant.findUnique({
    where: { id: user.tenantId },
    select: { imapHost: true, imapPort: true, imapUser: true, imapPassword: true, imapSecure: true, imapMailbox: true, lastInboundSyncAt: true },
  });
  const cfg = {
    host: tenant?.imapHost, port: tenant?.imapPort, user: tenant?.imapUser,
    password: tenant?.imapPassword, secure: tenant?.imapSecure, mailbox: tenant?.imapMailbox,
  };
  if (!isImapConfigured(cfg)) return { error: "Kein IMAP-Postfach konfiguriert (Einstellungen → E-Mail-Empfang)." };

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
    where: { tenantId: user.tenantId, email: { not: null } },
    select: { id: true, email: true },
  });

  let imported = 0;
  let matched = 0;
  for (const m of mails) {
    const key = dedupKey(m);
    const exists = await prisma.inboundEmail.findUnique({
      where: { tenantId_messageId: { tenantId: user.tenantId, messageId: key } },
      select: { id: true },
    });
    if (exists) continue;
    const personId = matchPersonId(m.fromAddress, persons);
    if (personId) matched++;
    await prisma.inboundEmail.create({
      data: {
        tenantId: user.tenantId,
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

  await prisma.tenant.update({ where: { id: user.tenantId }, data: { lastInboundSyncAt: new Date() } });
  if (imported > 0) await audit(user, "CREATE", "InboundEmail", null, `${imported} eingegangen, ${matched} zugeordnet`);
  revalidatePath("/", "layout");
  return { ok: true, error: `${imported} neue Mails, ${matched} zugeordnet` };
}
