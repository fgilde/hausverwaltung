import { getTranslations, getLocale } from "next-intl/server";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { money } from "@/lib/format";
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

export default async function ZensusPage() {
  const user = await requireUser();
  const t = await getTranslations();
  const locale = await getLocale();
  const now = new Date();

  const units = await prisma.unit.findMany({
    where: { tenantId: user.tenantId },
    include: {
      building: { include: { property: true } },
      leases: { select: { startDate: true, endDate: true, rentCold: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const activeLease = (u: (typeof units)[number]) =>
    u.leases.find((l) => l.startDate <= now && (!l.endDate || l.endDate >= now));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("zensus.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("zensus.subtitle")}</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {units.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">{t("units.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("units.property")}</TableHead>
                  <TableHead>{t("fields.label")}</TableHead>
                  <TableHead>{t("fields.type")}</TableHead>
                  <TableHead className="text-right">{t("fields.area")}</TableHead>
                  <TableHead className="text-right">{t("fields.rooms")}</TableHead>
                  <TableHead className="text-right">{t("zensus.rent")}</TableHead>
                  <TableHead>{t("units.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {units.map((u) => {
                  const l = activeLease(u);
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="text-muted-foreground">{u.building.property.name}</TableCell>
                      <TableCell className="font-medium">{u.label}</TableCell>
                      <TableCell>{t(`unitType.${u.type}`)}</TableCell>
                      <TableCell className="text-right">{String(u.area)}</TableCell>
                      <TableCell className="text-right">{u.rooms ? String(u.rooms) : t("common.none")}</TableCell>
                      <TableCell className="text-right">{l ? money(Number(l.rentCold), locale) : t("common.none")}</TableCell>
                      <TableCell>
                        {l ? (
                          <Badge variant="secondary">{t("units.occupied")}</Badge>
                        ) : (
                          <Badge variant="outline">{t("units.vacant")}</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
