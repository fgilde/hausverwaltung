import { getTranslations, getLocale } from "next-intl/server";
import { Send, Mail, Paperclip } from "lucide-react";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { date } from "@/lib/format";
import { isMailerConfigured } from "@/lib/adapters/mailer";
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
import { DeleteButton } from "@/components/delete-button";
import { sendEmail, deleteEmail } from "@/server/actions/email";

export default async function EmailPage() {
  const user = await requireUser();
  const t = await getTranslations();
  const locale = await getLocale();

  const [messages, tenant, persons, documents] = await Promise.all([
    prisma.emailMessage.findMany({
      where: { tenantId: user.tenantId },
      include: { _count: { select: { attachments: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { smtpHost: true, smtpPort: true, smtpUser: true, smtpFrom: true, smtpSecure: true },
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
  ]);
  const personOpts = persons.map((p) => ({ id: p.id, label: `${p.firstName} ${p.lastName}`, email: p.email! }));
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
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("email.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("email.subtitle")}</p>
        </div>
        <EmailCompose persons={personOpts} documents={documents} />
      </div>

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
                        {m.subject}
                        {m._count.attachments > 0 && (
                          <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                            <Paperclip className="size-3" />
                            {m._count.attachments}
                          </span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(m.status)}>{t(`emailStatus.${m.status}`)}</Badge>
                      {m.error ? <span className="ml-2 text-xs text-destructive">{m.error}</span> : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {m.sentAt ? date(m.sentAt, locale) : date(m.createdAt, locale)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
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
    </div>
  );
}
