import { Download, Building2, DoorOpen, KeyRound, DoorClosed, Coins } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { money } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function ReportsPage() {
  const user = await requireUser();
  const t = await getTranslations();
  const locale = await getLocale();
  const tenantId = user.tenantId;
  const now = new Date();

  const [properties, units, charges] = await Promise.all([
    prisma.property.findMany({
      where: { tenantId },
      include: { buildings: { include: { _count: { select: { units: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.unit.findMany({
      where: { tenantId },
      include: {
        building: { include: { property: true } },
        leases: { select: { startDate: true, endDate: true } },
      },
    }),
    prisma.charge.findMany({ where: { tenantId }, include: { payments: { select: { amount: true } } } }),
  ]);

  const occupied = units.filter((u) =>
    u.leases.some((l) => l.startDate <= now && (!l.endDate || l.endDate >= now)),
  );
  const vacant = units.filter((u) => !occupied.includes(u));
  const totalOpen = charges.reduce((a, c) => {
    const open = Number(c.amount) - c.payments.reduce((s, p) => s + Number(p.amount), 0);
    return a + Math.max(0, open);
  }, 0);

  const kpis = [
    { key: "properties", value: String(properties.length), icon: Building2 },
    { key: "units", value: String(units.length), icon: DoorOpen },
    { key: "occupied", value: String(occupied.length), icon: KeyRound },
    { key: "vacant", value: String(vacant.length), icon: DoorClosed },
    { key: "openItemsValue", value: money(totalOpen, locale), icon: Coins },
  ];

  const unitCount = (p: (typeof properties)[number]) => p.buildings.reduce((a, b) => a + b._count.units, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("reports.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("reports.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" render={<a href="/api/export/properties" />}>
            <Download className="size-4" />
            {t("reports.exportProperties")}
          </Button>
          <Button size="sm" variant="outline" render={<a href="/api/export/openitems" />}>
            <Download className="size-4" />
            {t("reports.exportOpenItems")}
          </Button>
          <Button size="sm" variant="outline" render={<a href="/api/export/tenants" />}>
            <Download className="size-4" />
            {t("reports.exportTenants")}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((k) => (
          <Card key={k.key}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t(`dashboard.${k.key}`)}
              </CardTitle>
              <k.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Leerstand */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("reports.vacancy")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {vacant.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">{t("reports.noVacancy")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("units.property")}</TableHead>
                  <TableHead>{t("fields.label")}</TableHead>
                  <TableHead>{t("fields.type")}</TableHead>
                  <TableHead className="text-right">{t("fields.area")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vacant.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="text-muted-foreground">{u.building.property.name}</TableCell>
                    <TableCell className="font-medium">{u.label}</TableCell>
                    <TableCell>{t(`unitType.${u.type}`)}</TableCell>
                    <TableCell className="text-right">{String(u.area)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Objektbestand */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("reports.portfolio")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("fields.name")}</TableHead>
                <TableHead>{t("fields.management")}</TableHead>
                <TableHead>{t("dashboard.location")}</TableHead>
                <TableHead className="text-right">{t("dashboard.unitsCount")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {properties.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{t(`managementType.${p.management}`)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.zip} {p.city}
                  </TableCell>
                  <TableCell className="text-right">{unitCount(p)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
