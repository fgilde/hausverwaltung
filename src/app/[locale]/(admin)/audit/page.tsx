import { getTranslations, getLocale } from "next-intl/server";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
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

const PAGE_SIZE = 50;
const ACTIONS = ["CREATE", "UPDATE", "DELETE"];

function dateTime(d: Date, locale: string) {
  return new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; entity?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireRole(["VERWALTER"]);
  const t = await getTranslations();
  const locale = await getLocale();

  const action = sp.action && ACTIONS.includes(sp.action) ? sp.action : "";
  const entity = (sp.entity ?? "").trim();
  const page = Math.max(1, Number(sp.page) || 1);

  const where = {
    tenantId: user.tenantId,
    ...(action ? { action: action as never } : {}),
    ...(entity ? { entity: { contains: entity, mode: "insensitive" as const } } : {}),
  };

  const [logs, total, entities] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where: { tenantId: user.tenantId }, select: { entity: true }, distinct: ["entity"], orderBy: { entity: "asc" } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const actionVariant = (a: string) => (a === "DELETE" ? "destructive" : a === "CREATE" ? "default" : "secondary");
  const qs = (p: number) => `/audit?${new URLSearchParams({ ...(action ? { action } : {}), ...(entity ? { entity } : {}), page: String(p) })}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("audit.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("audit.subtitle")}</p>
      </div>

      <form className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">{t("audit.action")}</label>
          <select name="action" defaultValue={action} className="flex h-9 rounded-lg border border-input bg-transparent px-3 text-sm dark:bg-input/30">
            <option value="">{t("common.all")}</option>
            {ACTIONS.map((a) => (<option key={a} value={a}>{t(`auditAction.${a}`)}</option>))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">{t("audit.entity")}</label>
          <select name="entity" defaultValue={entity} className="flex h-9 rounded-lg border border-input bg-transparent px-3 text-sm dark:bg-input/30">
            <option value="">{t("common.all")}</option>
            {entities.map((e) => (<option key={e.entity} value={e.entity}>{e.entity}</option>))}
          </select>
        </div>
        <Button type="submit" size="sm" variant="outline">{t("common.search")}</Button>
      </form>

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
                    <TableCell className="whitespace-nowrap text-muted-foreground">{dateTime(l.createdAt, locale)}</TableCell>
                    <TableCell>{l.userName ?? "—"}</TableCell>
                    <TableCell><Badge variant={actionVariant(l.action)}>{t(`auditAction.${l.action}`)}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{l.entity}</TableCell>
                    <TableCell>{l.summary ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{t("audit.pageOf", { page, pages })}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" disabled={page <= 1} render={page <= 1 ? <span /> : <Link href={qs(page - 1)} />}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" size="icon" disabled={page >= pages} render={page >= pages ? <span /> : <Link href={qs(page + 1)} />}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
