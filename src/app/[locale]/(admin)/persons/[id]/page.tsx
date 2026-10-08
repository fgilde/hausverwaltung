import { ArrowLeft, Landmark, Mail, MapPin, Phone } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireUser, roleAllows, WRITE_ROLES } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { money, date, dateTime, decimal } from "@/lib/format";
import { getDateLocale } from "@/lib/date-locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PersonDialog } from "@/components/entity-dialogs";
import { LeaseDialog } from "@/components/lease-dialogs";
import { EmailViewDialog } from "@/components/email-view-dialog";
import { AttachmentImportProvider } from "@/components/mail-attachments";
import { fromInbound, fromOutbound } from "@/lib/mail-attachments";
import { attachmentDefaults, attachmentImportOptions } from "@/server/attachments";
import { EmailCompose } from "@/components/email-compose";
import { sendEmail } from "@/server/actions/email";
import { addr, ownMailIdentity } from "@/lib/threads";
import { threadKey } from "@/lib/inbound";
import { Paperclip, Send } from "lucide-react";

export default async function PersonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const t = await getTranslations();
  const locale = await getLocale();
  const df = await getDateLocale(locale);

  const person = await prisma.person.findFirst({
    where: { id, tenantId: user.tenantId },
    include: {
      renters: { include: { lease: { include: { unit: { include: { building: { include: { property: true } } } } } } } },
      owners: { include: { unit: { include: { building: { include: { property: true } } } } } },
    },
  });
  if (!person) notFound();

  const [units, customDefs, leaseDefs, own, documents, templates] = await Promise.all([
    prisma.unit.findMany({
      where: { tenantId: user.tenantId },
      include: { building: { include: { property: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.customFieldDef.findMany({
      where: { tenantId: user.tenantId, entity: "PERSON" },
      orderBy: { createdAt: "asc" },
      select: { key: true, label: true },
    }),
    prisma.customFieldDef.findMany({
      where: { tenantId: user.tenantId, entity: "LEASE" },
      orderBy: { createdAt: "asc" },
      select: { key: true, label: true },
    }),
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
  // E-Mail-Kommunikationsverlauf (#39): ausgehende Mails (an To/Cc) und eingehende
  // Mails (per IMAP-Import, Absender = Kontakt) chronologisch zusammengeführt.
  const [outbound, inbound] = person.email
    ? await Promise.all([
        prisma.emailMessage.findMany({
          where: {
            tenantId: user.tenantId,
            OR: [
              { toAddress: { contains: person.email, mode: "insensitive" } },
              { cc: { contains: person.email, mode: "insensitive" } },
            ],
          },
          include: {
            attachments: { include: { document: { select: { id: true, name: true, mime: true } } } },
            sentBy: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.inboundEmail.findMany({
          where: {
            tenantId: user.tenantId,
            OR: [{ personId: person.id }, { fromAddress: { equals: person.email, mode: "insensitive" } }],
          },
          include: { attachments: true },
          orderBy: { receivedAt: "desc" },
        }),
      ])
    : [[], []];
  const emailStatusVariant = (s: string) =>
    s === "GESENDET" ? "secondary" : s === "FEHLER" ? "destructive" : "outline";

  // Ein- und ausgehende Mails in einheitlicher Form (gleiche Zeile, gleicher Dialog).
  // Von/An immer als „Name <Adresse>“: Verwaltung = Mandantenname + SMTP- bzw.
  // IMAP-Adresse, Kontakt = Kontaktname (#44).
  const personName = `${person.firstName} ${person.lastName}`;
  const toLabel = (to: string) =>
    to.trim().toLowerCase() === person.email?.toLowerCase() ? addr(personName, person.email!) : to;
  const communication = [
    ...outbound.map((m) => ({
      dir: "out" as const, id: m.id, date: m.sentAt ?? m.createdAt, subject: m.subject, status: m.status as string | null,
      thread: threadKey(m), sender: m.sentBy?.name ?? null, from: own.from, toAddress: toLabel(m.toAddress), cc: m.cc, body: m.body, html: m.html,
      attachments: m.attachments.map(fromOutbound),
    })),
    ...inbound.map((m) => ({
      dir: "in" as const, id: m.id, date: m.receivedAt, subject: m.subject ?? "(ohne Betreff)", status: null,
      thread: threadKey(m), sender: m.fromName || personName, from: addr(m.fromName || personName, m.fromAddress), toAddress: own.inbox,
      cc: null, body: m.body, html: null, attachments: m.attachments.map(fromInbound),
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  // Anhänge übernehmen (#52), vorbelegt mit Kontakt + Objekt/Einheit (#51)
  const canWrite = roleAllows(user.role, WRITE_ROLES);
  const [importOptions, defaultsMap] =
    canWrite && inbound.length
      ? await Promise.all([attachmentImportOptions(user.tenantId), attachmentDefaults(user.tenantId, [person.id])])
      : [null, new Map()];
  const importDefaults = defaultsMap.get(person.id);

  const customValues = (person.custom as Record<string, string>) ?? {};
  const unitOpts = units.map((u) => ({
    value: u.id,
    label: `${u.building.property.name} · ${u.building.name} · ${u.label}`,
  }));

  return (
    <AttachmentImportProvider options={importOptions}>
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" render={<Link href="/persons" />}>
            <ArrowLeft className="size-4" />
            {t("persons.title")}
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">
            {person.firstName} {person.lastName}
          </h1>
          <div className="flex flex-wrap items-center gap-3 pt-1 text-sm text-muted-foreground">
            <Badge variant="outline">{t(`personType.${person.type}`)}</Badge>
            {person.email && (
              <span className="flex items-center gap-1">
                <Mail className="size-3.5" /> {person.email}
              </span>
            )}
            {person.phone && (
              <span className="flex items-center gap-1">
                <Phone className="size-3.5" /> {person.phone}
              </span>
            )}
            {person.address && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" /> {person.address.split(/\r?\n/).filter(Boolean).join(", ")}
              </span>
            )}
            {person.iban && (
              <span className="flex items-center gap-1">
                <Landmark className="size-3.5" /> {person.iban.replace(/(.{4})/g, "$1 ").trim()}
                {person.accountHolder && ` · ${person.accountHolder}`}
              </span>
            )}
          </div>
          {person.note && <p className="max-w-xl pt-2 text-sm">{person.note}</p>}
        </div>
        <PersonDialog
          customDefs={customDefs}
          person={{
            id: person.id,
            firstName: person.firstName,
            lastName: person.lastName,
            email: person.email,
            phone: person.phone,
            type: person.type,
            note: person.note,
            iban: person.iban,
            accountHolder: person.accountHolder,
            address: person.address,
            custom: customValues,
          }}
        />
      </div>

      {/* Mietverhältnisse */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{t("persons.tenancies")}</CardTitle>
          <LeaseDialog units={unitOpts} presetPersonId={person.id} customDefs={leaseDefs} triggerLabel={t("leases.new")} />
        </CardHeader>
        <CardContent className="space-y-2">
          {person.renters.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("persons.noTenancies")}</p>
          ) : (
            person.renters.map((r) => (
              <Link
                key={r.id}
                href={`/leases/${r.leaseId}`}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted"
              >
                <span className="font-medium">
                  {r.lease.unit.building.property.name} · {r.lease.unit.label}
                </span>
                <span className="text-muted-foreground">
                  {money(Number(r.lease.rentCold), locale)} · {date(r.lease.startDate, df)}
                </span>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      {/* Eigentum */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("persons.ownerships")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {person.owners.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("persons.noOwnerships")}</p>
          ) : (
            person.owners.map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span className="font-medium">
                  {o.unit.building.property.name} · {o.unit.label}
                </span>
                <span className="text-muted-foreground">
                  {t("weg.share")}: {decimal(o.share, locale)}‰ · MEA {decimal(o.unit.mea, locale)}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* E-Mail-Kommunikation (#39) */}
      {person.email && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="text-base">{t("persons.communication")}</CardTitle>
              <p className="text-xs text-muted-foreground">{t("persons.communicationHint")}</p>
            </div>
            <EmailCompose
              persons={[]}
              documents={documents}
              templates={templates}
              defaultTo={person.email}
              triggerLabel={t("persons.newMessage")}
            />
          </CardHeader>
          <CardContent className="space-y-1.5">
            {communication.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("persons.noCommunication")}</p>
            ) : (
              communication.map((c) => (
                <div key={c.dir + c.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-medium">
                      <Link href={`/email/thread/${c.thread}`} className="truncate hover:underline">{c.subject}</Link>
                      {c.attachments.length > 0 && (
                        <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                          <Paperclip className="size-3" />
                          {c.attachments.length}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {dateTime(c.date, df)}
                      {c.sender ? ` · ${c.sender}` : ""}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {c.status ? (
                      <Badge variant={emailStatusVariant(c.status)}>{t(`emailStatus.${c.status}`)}</Badge>
                    ) : (
                      <Badge variant="secondary">{t("persons.received")}</Badge>
                    )}
                    {c.status && c.status !== "GESENDET" && (
                      <form action={sendEmail}>
                        <input type="hidden" name="id" value={c.id} />
                        <Button type="submit" variant="ghost" size="icon" aria-label={t("email.send")} title={t("email.send")}>
                          <Send className="size-4" />
                        </Button>
                      </form>
                    )}
                    <EmailViewDialog
                      message={{
                        from: c.from, toAddress: c.toAddress, cc: c.cc, date: dateTime(c.date, df),
                        subject: c.subject, body: c.body, html: c.html, attachments: c.attachments,
                      }}
                      inbound={c.dir === "in"}
                      importDefaults={importDefaults}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {customDefs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("customFields.title")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {customDefs.map((d) => (
              <div key={d.key} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{d.label}</span>
                <span>{customValues[d.key] || t("common.none")}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
    </AttachmentImportProvider>
  );
}
