import { getTranslations, getLocale } from "next-intl/server";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function dateTime(d: Date, locale: string) {
  return new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export default async function AuditPage() {
  // Nur Verwalter/Admin — Nachvollziehbarkeit ist ein Leitungsthema.
  const user = await requireRole(["VERWALTER"]);
  const t = await getTranslations();
  const locale = await getLocale();

  const logs = await prisma.auditLog.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const actionVariant = (a: string) =>
    a === "DELETE" ? "destructive" : a === "CREATE" ? "default" : "secondary";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("audit.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("audit.subtitle")}</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">{t("audit.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("audit.time")}</TableHead>
                  <TableHead>{t("audit.user")}</TableHead>
                  <TableHead>{t("audit.action")}</TableHead>
                  <TableHead>{t("audit.entity")}</TableHead>
                  <TableHead>{t("audit.summary")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {dateTime(l.createdAt, locale)}
                    </TableCell>
                    <TableCell>{l.userName ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={actionVariant(l.action)}>{t(`auditAction.${l.action}`)}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{l.entity}</TableCell>
                    <TableCell>{l.summary ?? "—"}</TableCell>
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
