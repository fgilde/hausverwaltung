import { ArrowLeft, Check, Reply, Send } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireUser, roleAllows, WRITE_ROLES } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { dateTime } from "@/lib/format";
import { getDateLocale } from "@/lib/date-locale";
import { addr, loadThread, ownMailIdentity, threadWhere } from "@/lib/threads";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AttachmentImportProvider, MailAttachmentList } from "@/components/mail-attachments";
import { DeleteButton } from "@/components/delete-button";
import { MailBody } from "@/components/mail-body";
import { attachmentDefaults, attachmentImportOptions } from "@/server/attachments";
import { EmailCompose } from "@/components/email-compose";
import { sendEmail } from "@/server/actions/email";
import { setThreadDone, deleteThread } from "@/server/actions/inbound";
import { cn } from "@/lib/utils";

// Unterhaltung (#43): alle ein- und ausgehenden Mails eines Threads chronologisch.
export default async function ThreadPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const user = await requireUser();
  const canWrite = roleAllows(user.role, WRITE_ROLES);
  const t = await getTranslations();
  const df = await getDateLocale(await getLocale());

  // Öffnen der Unterhaltung = gelesen (nur für Bearbeiter, Leser ändern nichts).
  if (canWrite) {
    await prisma.inboundEmail.updateMany({
      where: { ...threadWhere(user.tenantId, key), readAt: null },
      data: { readAt: new Date() },
    });
  }
  const [messages, own, documents, templates] = await Promise.all([
    loadThread(user.tenantId, key),
    ownMailIdentity(user.tenantId),
    prisma.document.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, name: true },
    }),
    prisma.template.findMany({
      where: { tenantId: user.tenantId },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: { id: true, name: true, subject: true, body: true },
    }),
  ]);
  if (messages.length === 0) notFound();

  // Anhänge übernehmen (#52), vorbelegt je Absender (#51)
  const inboundMails = messages.flatMap((m) => (m.dir === "in" ? [m] : []));
  const hasPending = inboundMails.some((m) => m.attachments.some((a) => !a.documentId));
  const [importOptions, importDefaults] =
    canWrite && hasPending
      ? await Promise.all([attachmentImportOptions(user.tenantId), attachmentDefaults(user.tenantId, inboundMails.map((m) => m.personId))])
      : [null, new Map()];

  // Namen der Empfänger ausgehender Mails (Kontakte), für „An: Name <Adresse>“ (#44)
  const outAddrs = [...new Set(messages.flatMap((m) => (m.dir === "out" ? m.toAddress.split(/[,;]/).map((a) => a.trim()) : [])))];
  const contacts = await prisma.person.findMany({
    where: { tenantId: user.tenantId, email: { in: outAddrs, mode: "insensitive" } },
    select: { email: true, firstName: true, lastName: true },
  });
  const nameOf = new Map(contacts.map((c) => [c.email!.toLowerCase(), `${c.firstName} ${c.lastName}`]));
  const toLabel = (to: string) =>
    to.split(/[,;]/).map((a) => a.trim()).filter(Boolean).map((a) => addr(nameOf.get(a.toLowerCase()), a)).join(", ");

  const first = messages[0];
  const last = messages[messages.length - 1];
  const subject = first.subject ?? "(ohne Betreff)";
  const inbound = messages.flatMap((m) => (m.dir === "in" ? [m] : []));
  const open = inbound.some((m) => !m.doneAt);
  // Antwort geht an die letzte eingegangene Mail, sonst Nachfassen an den letzten Empfänger.
  const lastIn = inbound.at(-1);
  const replyTarget = lastIn ?? last;
  const replyTo = lastIn ? lastIn.fromAddress : last.dir === "out" ? last.toAddress : "";
  const counterpart = lastIn
    ? lastIn.person ? `${lastIn.person.firstName} ${lastIn.person.lastName}` : lastIn.fromName || lastIn.fromAddress
    : first.dir === "out" ? first.toAddress : "";

  return (
    <AttachmentImportProvider options={importOptions}>
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <Button variant="ghost" size="sm" render={<Link href="/email" />}>
            <ArrowLeft className="size-4" />
            {t("email.title")}
          </Button>
          <h1 className="truncate text-2xl font-semibold tracking-tight">{subject}</h1>
          <p className="text-sm text-muted-foreground">
            {counterpart} · {t("email.messageCount", { count: messages.length })}
          </p>
        </div>
        {canWrite && (
          <div className="flex shrink-0 items-center gap-2">
            <DeleteButton action={deleteThread} id={key} redirectTo="/email" description={t("email.deleteThreadDesc")} />
            {inbound.length > 0 && (
              <form action={setThreadDone}>
                <input type="hidden" name="key" value={key} />
                <input type="hidden" name="value" value={open ? "true" : "false"} />
                <Button type="submit" variant="outline" size="sm">
                  <Check className="size-4" />
                  {t(open ? "email.markDone" : "email.markOpen")}
                </Button>
              </form>
            )}
            <EmailCompose
              persons={[]}
              documents={documents}
              templates={templates}
              defaultTo={replyTo}
              defaultSubject={/^re:/i.test(subject) ? subject : `Re: ${subject}`}
              quote={replyTarget.body ?? ""}
              triggerLabel={t("email.reply")}
              replyTo={{ kind: replyTarget.dir, id: replyTarget.id }}
              trigger={
                <Button size="sm">
                  <Reply className="size-4" />
                  {t("email.reply")}
                </Button>
              }
            />
          </div>
        )}
      </div>

      <div className="space-y-3">
        {messages.map((m) => {
          const from =
            m.dir === "in"
              ? addr(m.person ? `${m.person.firstName} ${m.person.lastName}` : m.fromName, m.fromAddress)
              : m.sentBy?.name
                ? `${m.sentBy.name} · ${own.from}`
                : own.from;
          const to = m.dir === "in" ? own.inbox : toLabel(m.toAddress);
          return (
            <Card key={m.dir + m.id} className={cn(m.dir === "out" && "ml-8 bg-muted/30", m.dir === "in" && "mr-8")}>
              <CardContent className="space-y-3">
                <div className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0 text-muted-foreground">
                    <div>
                      <span className="font-medium text-foreground">{t("email.from")}:</span> {from}
                    </div>
                    {to && (
                      <div>
                        <span className="font-medium text-foreground">{t("email.to")}:</span> {to}
                      </div>
                    )}
                    {m.dir === "out" && m.cc && <div>Cc: {m.cc}</div>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-muted-foreground">{dateTime(m.at, df)}</span>
                    {m.dir === "in" ? (
                      <Badge variant="secondary">{t("persons.received")}</Badge>
                    ) : (
                      <Badge variant={m.status === "FEHLER" ? "destructive" : m.status === "GESENDET" ? "secondary" : "outline"}>
                        {t(`emailStatus.${m.status}`)}
                      </Badge>
                    )}
                    {canWrite && m.dir === "out" && m.status !== "GESENDET" && (
                      <form action={sendEmail}>
                        <input type="hidden" name="id" value={m.id} />
                        <Button type="submit" variant="ghost" size="icon" aria-label={t("email.send")} title={t("email.send")}>
                          <Send className="size-4" />
                        </Button>
                      </form>
                    )}
                  </div>
                </div>
                {m.subject && m.subject !== subject && <div className="text-sm font-medium">{m.subject}</div>}
                <MailBody html={m.dir === "out" ? m.html : null} text={m.body} />
                {m.attachments.length > 0 && (
                  <div className="border-t pt-2">
                    <MailAttachmentList
                      attachments={m.attachments}
                      inbound={m.dir === "in"}
                      defaults={m.dir === "in" && m.personId ? importDefaults.get(m.personId) : undefined}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
    </AttachmentImportProvider>
  );
}
