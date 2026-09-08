import { getTranslations, getLocale } from "next-intl/server";
import { requireSuperAdmin } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { date } from "@/lib/format";
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
import { TenantDialog } from "@/components/tenant-dialog";
import { DeleteButton } from "@/components/delete-button";
import { switchTenant, deleteTenant } from "@/server/actions/tenants";

export default async function TenantsPage() {
  const user = await requireSuperAdmin();
  const t = await getTranslations();
  const locale = await getLocale();

  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, isDemo: true, createdAt: true, _count: { select: { users: true, properties: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("tenants.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("tenants.subtitle")}</p>
        </div>
        <TenantDialog />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("tenants.name")}</TableHead>
                <TableHead className="text-right">{t("tenants.users")}</TableHead>
                <TableHead className="text-right">{t("tenants.properties")}</TableHead>
                <TableHead>{t("tenants.created")}</TableHead>
                <TableHead className="w-48 text-right">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((tn) => {
                const isHome = tn.id === user.homeTenantId;
                const isActive = tn.id === user.tenantId;
                return (
                  <TableRow key={tn.id}>
                    <TableCell className="font-medium">
                      {tn.name}
                      {isHome && <Badge variant="outline" className="ml-2">{t("tenants.home")}</Badge>}
                      {tn.isDemo && <Badge variant="outline" className="ml-2">Demo</Badge>}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{tn._count.users}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{tn._count.properties}</TableCell>
                    <TableCell className="text-muted-foreground">{date(tn.createdAt, locale)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {isActive ? (
                          <Badge variant="secondary">{t("tenants.active")}</Badge>
                        ) : (
                          <form action={switchTenant}>
                            <input type="hidden" name="tenantId" value={tn.id} />
                            <Button type="submit" variant="outline" size="sm">{t("tenants.switch")}</Button>
                          </form>
                        )}
                        {!isHome && <DeleteButton action={deleteTenant} id={tn.id} />}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
