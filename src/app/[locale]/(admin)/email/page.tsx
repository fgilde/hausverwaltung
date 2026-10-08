import { getTranslations, getLocale } from "next-intl/server";
import { Send, Mail, Paperclip, Reply, Check, CircleDot, FileText } from "lucide-react";
import { requireUser, roleAllows, WRITE_ROLES } from "@/lib/rbac";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { date, dateTime } from "@/lib/format";
import { getDateLocale } from "@/lib/date-locale";
import { isMailerConfigured } from "@/lib/adapters/mailer";
import { isImapConfigured } from "@/lib/adapters/imap";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmailCompose } from "@/components/email-compose";
import { BulkEmailDialog } from "@/components/bulk-email-dialog";
import { EmailViewDialog } from "@/components/email-view-dialog";
import { DeleteButton } from "@/components/delete-button";
import { sendEmail, deleteEmail } from "@/server/actions/email";
import { setInboundFlag, deleteInboundEmail } from "@/server/actions/inbound";
import { AttachmentImportProvider } from "@/components/mail-attachments";
import { fromInbound, fromOutbound } from "@/lib/mail-attachments";
import { attachmentDefaults, attachmentImportOptions } from "@/server/attachments";
import { InboxSyncButton } from "@/components/inbox-sync-button";
import { cn } from "@/lib/utils";
import { listThreads } from "@/lib/threads";
import { threadKey } from "@/lib/inbound";
import { LetterDialog, LetterSendDialog, LetterRefreshButton } from "@/components/letter-dialogs";
import { deleteLetter } from "@/server/actions/letters";
import { configuredProviders, letterRecipients, senderLines } from "@/server/letters";

// Kommunikation (#43): Unterhaltungen (Threads), Posteingang (IMAP-Import),
// Postausgang und Briefe (#58) auf einer Seite.
export default async function EmailPage({ searchParams }: { searchParams: Promise<{ box?: string }> }) {
  const sp = (await searchParams).box;
  const box = sp === "out" || sp === "in" || sp === "letters" ? sp : "threads";
  const user = await requireUser();
  const canWrite = roleAllows(user.role, WRITE_ROLES);
  const t = await getTranslations();
  const locale = await getLocale();
  const df = await getDateLocale(locale);

  const [messages, tenant, persons, documents, properties, templates, inbound, unread, threads] = await Promise.all([
    prisma.emailMessage.findMany({
      where: { tenantId: user.tenantId },
      include: { attachments: { include: { document: { select: { id: true, name: true, mime: true } } } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { smtpHost: true, smtpPort: true, smtpUser: true, smtpFrom: true, smtpSecure: true, imapHost: true, imapUser: true, address: true },
    }),
    prisma.person.findMany({
      where: { tenantId: user.tenantId, email: { not: null } },
      orderBy: { lastName: "asc" },
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
    prisma.document.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, name: true },
    }),
    prisma.property.findMany({ where: { tenantId: user.tenantId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.template.findMany({
      where: { tenantId: user.tenantId },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: { id: true, name: true, subject: true, body: true },
    }),
    // ponytail: feste Obergrenze statt Paginierung, Seiten wenn Postfächer größer werden
    box === "in"
      ? prisma.inboundEmail.findMany({
          where: { tenantId: user.tenantId },
          include: {
            person: { select: { id: true, firstName: true, lastName: true } },
            attachments: true,
          },
          orderBy: { receivedAt: "desc" },
          take: 200,
        })
      : [],
    prisma.inboundEmail.count({ where: { tenantId: user.tenantId, readAt: null } }),
    box === "threads" ? listThreads(user.tenantId) : [],
  ]);
  // Briefe (#58)
  const [letters, letterProviders, recipients] = canWrite || box === "letters"
    ? await Promise.all([
        box === "letters"
          ? prisma.letter.findMany({
              where: { tenantId: user.tenantId },
              include: { person: { select: { id: true, firstName: true, lastName: true } } },
              orderBy: { createdAt: "desc" },
              take: 200,
            })
          : [],
        configuredProviders(user.tenantId),
        canWrite ? letterRecipients(user.tenantId) : [],
      ])
    : [[], [], []];
  const imapConfigured = isImapConfigured({ host: tenant?.imapHost, user: tenant?.imapUser });
  // Anhänge übernehmen (#52): Auswahllisten + Vorbelegung je Absender (#51)
  const [importOptions, importDefaults] =
    box === "in" && canWrite
      ? await Promise.all([attachmentImportOptions(user.tenantId), attachmentDefaults(user.tenantId, inbound.map((m) => m.personId))])
      : [null, new Map()];
  const personOpts = persons.map((p) => ({ id: p.id, label: `${p.firstName} ${p.lastName}`, email: p.email! }));
  const propertyOpts = properties.map((p) => ({ value: p.id, label: p.name }));
  const configured = isMailerConfigured({
    host: tenant?.smtpHost,
    port: tenant?.smtpPort,
    user: tenant?.smtpUser,
    from: tenant?.smtpFrom,
    secure: tenant?.smtpSecure,
  });

  const statusVariant = (s: string) =>
    s === "GESENDET" ? "secondary" : s === "FEHLER" ? "destructive" : "outline";

  return (
    <AttachmentImportProvider options={importOptions}>
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("email.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("email.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          {propertyOpts.length > 0 && <BulkEmailDialog properties={propertyOpts} templates={templates} documents={documents} />}
          {canWrite && (
            <LetterDialog
              recipients={recipients}
              templates={templates}
              providers={letterProviders}
              place={senderLines(tenant?.address).city}
              today={date(new Date(), df)}
            />
          )}
          <EmailCompose persons={personOpts} documents={documents} templates={templates} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 border-b">
        <div className="flex gap-1">
          {(["threads", "in", "out", "letters"] as const).map((b) => (
            <Link
              key={b}
              href={b === "threads" ? "/email" : `/email?box=${b}`}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
                box === b ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t(b === "threads" ? "email.threads" : b === "in" ? "email.inbox" : b === "out" ? "email.outbox" : "letters.title")}
              {b === "in" && unread > 0 && <Badge className="ml-2">{unread}</Badge>}
            </Link>
          ))}
        </div>
        {box === "letters"
          ? canWrite && letters.some((l) => l.status === "EINGEREICHT" || l.status === "VERSENDET") && <LetterRefreshButton />
          : box !== "out" && imapConfigured && canWrite && <InboxSyncButton />}
      </div>

      {box === "threads" && (
        <Card>
          <CardContent className="p-0">
            {threads.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">{t("email.noThreads")}</p>
            ) : (
              <div className="divide-y">
                {threads.map((th) => (
                  <Link
                    key={th.key}
                    href={`/email/thread/${th.key}`}
                    className={cn("flex items-center justify-between gap-4 px-4 py-3 text-sm hover:bg-muted", th.unread > 0 && "bg-muted/40")}
                  >
                    <div className="min-w-0">
                      <div className={cn("flex items-center gap-2", th.unread > 0 && "font-semibold")}>
                        <span className="truncate">{th.subject}</span>
                        {th.count > 1 && <span className="text-xs font-normal text-muted-foreground">({th.count})</span>}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{th.counterpart}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {th.unread > 0 && <Badge>{t("email.unreadCount", { count: th.unread })}</Badge>}
                      {th.hasInbound &&
                        (th.open ? (
                          <Badge variant="outline">{t("email.open")}</Badge>
                        ) : (
                          <Badge variant="secondary">{t("email.done")}</Badge>
                        ))}
                      <span className="w-28 text-right text-xs text-muted-foreground">{dateTime(th.lastAt, df)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {box === "in" ? (
        <Card>
          <CardContent className="p-0">
            {inbound.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">{t(imapConfigured ? "email.inboxEmpty" : "email.noImap")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("email.from")}</TableHead>
                    <TableHead>{t("email.subject")}</TableHead>
                    <TableHead>{t("email.status")}</TableHead>
                    <TableHead>{t("fields.date")}</TableHead>
                    <TableHead className="w-40 text-right">{t("common.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inbound.map((m) => {
                    const name = m.person ? `${m.person.firstName} ${m.person.lastName}` : m.fromName || m.fromAddress;
                    const subject = m.subject ?? "(ohne Betreff)";
                    return (
                      <TableRow key={m.id} className={cn(!m.readAt && "bg-muted/40")}>
                        <TableCell className={cn(!m.readAt && "font-semibold")}>
                          {m.person ? (
                            <Link href={`/persons/${m.person.id}`} className="hover:underline">
                              {name}
                            </Link>
                          ) : (
                            name
                          )}
                          {name !== m.fromAddress && (
                            <div className="text-xs font-normal text-muted-foreground">{m.fromAddress}</div>
                          )}
                        </TableCell>
                        <TableCell className={cn(!m.readAt && "font-semibold")}>
                          <span className="flex items-center gap-2">
                            <Link href={`/email/thread/${threadKey(m)}`} className="hover:underline">
                              {subject}
                            </Link>
                            {m.attachments.length > 0 && (
                              <span className="flex items-center gap-0.5 text-xs font-normal text-muted-foreground">
                                <Paperclip className="size-3" />
                                {m.attachments.length}
                              </span>
                            )}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {!m.readAt && <Badge>{t("email.unread")}</Badge>}
                            {m.doneAt ? (
                              <Badge variant="secondary">{t("email.done")}</Badge>
                            ) : (
                              <Badge variant="outline">{t("email.open")}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{dateTime(m.receivedAt, df)}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <EmailViewDialog
                              markReadId={canWrite && !m.readAt ? m.id : undefined}
                              message={{
                                from: m.fromName ? `${m.fromName} <${m.fromAddress}>` : m.fromAddress,
                                date: dateTime(m.receivedAt, df),
                                subject,
                                body: m.body,
                                attachments: m.attachments.map(fromInbound),
                              }}
                              inbound
                              importDefaults={m.personId ? importDefaults.get(m.personId) : undefined}
                            />
                            {canWrite && (
                              <>
                                <EmailCompose
                                  persons={[]}
                                  documents={documents}
                                  templates={templates}
                                  defaultTo={m.fromAddress}
                                  replyTo={{ kind: "in", id: m.id }}
                                  defaultSubject={/^re:/i.test(subject) ? subject : `Re: ${subject}`}
                                  quote={m.body}
                                  triggerLabel={t("email.reply")}
                                  trigger={
                                    <Button variant="ghost" size="icon" aria-label={t("email.reply")} title={t("email.reply")}>
                                      <Reply className="size-4" />
                                    </Button>
                                  }
                                />
                                <form action={setInboundFlag}>
                                  <input type="hidden" name="id" value={m.id} />
                                  <input type="hidden" name="flag" value="read" />
                                  <input type="hidden" name="value" value={m.readAt ? "false" : "true"} />
                                  <Button
                                    type="submit"
                                    variant="ghost"
                                    size="icon"
                                    aria-label={t(m.readAt ? "email.markUnread" : "email.markRead")}
                                    title={t(m.readAt ? "email.markUnread" : "email.markRead")}
                                  >
                                    <CircleDot className="size-4" />
                                  </Button>
                                </form>
                                <form action={setInboundFlag}>
                                  <input type="hidden" name="id" value={m.id} />
                                  <input type="hidden" name="flag" value="done" />
                                  <input type="hidden" name="value" value={m.doneAt ? "false" : "true"} />
                                  <Button
                                    type="submit"
                                    variant="ghost"
                                    size="icon"
                                    aria-label={t(m.doneAt ? "email.markOpen" : "email.markDone")}
                                    title={t(m.doneAt ? "email.markOpen" : "email.markDone")}
                                  >
                                    <Check className={cn("size-4", m.doneAt && "text-primary")} />
                                  </Button>
                                </form>
                                <DeleteButton action={deleteInboundEmail} id={m.id} />
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : box === "out" ? (
      <>
      {!configured && (
        <div className="rounded-md border-l-2 border-amber-500 bg-amber-500/10 px-3 py-2 text-sm text-muted-foreground">
          {t("email.noSmtp")}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {messages.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">{t("email.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("email.to")}</TableHead>
                  <TableHead>{t("email.subject")}</TableHead>
                  <TableHead>{t("email.status")}</TableHead>
                  <TableHead>{t("fields.date")}</TableHead>
                  <TableHead className="w-32 text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {messages.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        <Mail className="size-4 text-muted-foreground" />
                        {m.toAddress}
                      </span>
                      {m.cc ? <div className="text-xs text-muted-foreground">Cc: {m.cc}</div> : null}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <Link href={`/email/thread/${threadKey(m)}`} className="hover:underline">
                          {m.subject}
                        </Link>
                        {m.attachments.length > 0 && (
                          <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                            <Paperclip className="size-3" />
                            {m.attachments.length}
                          </span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(m.status)}>{t(`emailStatus.${m.status}`)}</Badge>
                      {m.error ? <span className="ml-2 text-xs text-destructive">{m.error}</span> : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {m.sentAt ? date(m.sentAt, df) : date(m.createdAt, df)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <EmailViewDialog
                          message={{
                            toAddress: m.toAddress,
                            cc: m.cc,
                            subject: m.subject,
                            body: m.body,
                            html: m.html,
                            attachments: m.attachments.map(fromOutbound),
                          }}
                        />
                        {m.status !== "GESENDET" && (
                          <form action={sendEmail}>
                            <input type="hidden" name="id" value={m.id} />
                            <Button type="submit" variant="ghost" size="sm">
                              <Send className="size-4" />
                              {t("email.send")}
                            </Button>
                          </form>
                        )}
                        <DeleteButton action={deleteEmail} id={m.id} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      </>
      ) : box === "letters" ? (
        <Card>
          <CardContent className="p-0">
            {letters.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">{t("letters.empty")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("letters.recipient")}</TableHead>
                    <TableHead>{t("letters.subject")}</TableHead>
                    <TableHead>{t("letters.shipping")}</TableHead>
                    <TableHead>{t("fields.date")}</TableHead>
                    <TableHead className="w-32 text-right">{t("common.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {letters.map((l) => {
                    const lines = l.recipient.split("\n");
                    const test = (l.options as { test?: boolean } | null)?.test;
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">
                          {l.person ? (
                            <Link href={`/persons/${l.person.id}`} className="hover:underline">{lines[0]}</Link>
                          ) : (
                            lines[0]
                          )}
                          <div className="text-xs text-muted-foreground">{lines.slice(1).join(", ")}</div>
                        </TableCell>
                        <TableCell className="max-w-72 whitespace-normal">{l.subject}</TableCell>
                        <TableCell className="whitespace-normal">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <Badge variant={l.status === "FEHLER" ? "destructive" : l.status === "ENTWURF" ? "outline" : "secondary"}>
                              {t(`letterStatus.${l.status}`)}
                            </Badge>
                            {l.provider && <span className="text-xs text-muted-foreground">{t(`letters.provider_${l.provider}`)}</span>}
                            {test && <Badge variant="outline">{t("letters.testMode")}</Badge>}
                          </span>
                          {l.statusText && l.status !== "VERSENDET" && l.status !== "ZUGESTELLT" && (
                            <div className={cn("mt-0.5 text-xs", l.status === "FEHLER" ? "text-destructive" : "text-muted-foreground")}>
                              {l.statusText}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{date(l.sentAt ?? l.createdAt, df)}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            {l.documentId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                title={t("letters.pdf")}
                                render={<a href={`/api/documents/${l.documentId}`} target="_blank" rel="noopener noreferrer" />}
                              >
                                <FileText className="size-4" />
                              </Button>
                            )}
                            {canWrite && letterProviders.length > 0 && (l.status === "ENTWURF" || l.status === "FEHLER") && (
                              <LetterSendDialog id={l.id} providers={letterProviders} />
                            )}
                            {canWrite && <DeleteButton action={deleteLetter} id={l.id} />}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
    </AttachmentImportProvider>
  );
}
