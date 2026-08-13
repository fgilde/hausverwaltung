import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/rbac";
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
import { UnitDialog } from "@/components/entity-dialogs";
import { LeaseDialog } from "@/components/lease-dialogs";
import { ImportDialog } from "@/components/import-dialog";
import { DeleteButton } from "@/components/delete-button";
import { deleteUnit } from "@/server/actions/objects";

export default async function UnitsPage() {
  const user = await requireUser();
  const t = await getTranslations();

  const [units, customDefs, leaseDefs, persons] = await Promise.all([
    prisma.unit.findMany({
      where: { tenantId: user.tenantId },
      include: {
        building: { include: { property: true } },
        leases: {
          select: {
            startDate: true,
            endDate: true,
            renters: { include: { person: { select: { firstName: true, lastName: true } } } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.customFieldDef.findMany({
      where: { tenantId: user.tenantId, entity: "UNIT" },
      orderBy: { createdAt: "asc" },
      select: { key: true, label: true },
    }),
    prisma.customFieldDef.findMany({
      where: { tenantId: user.tenantId, entity: "LEASE" },
      orderBy: { createdAt: "asc" },
      select: { key: true, label: true },
    }),
    prisma.person.findMany({
      where: { tenantId: user.tenantId },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);

  const personOpts = persons.map((p) => ({ value: p.id, label: `${p.firstName} ${p.lastName}` }));
  const now = new Date();
  type LeaseRow = {
    startDate: Date;
    endDate: Date | null;
    renters: { person: { firstName: string; lastName: string } }[];
  };
  const activeLease = (leases: LeaseRow[]) =>
    leases.find((l) => l.startDate <= now && (!l.endDate || l.endDate >= now));
  const occupied = (leases: LeaseRow[]) => !!activeLease(leases);
  const tenantNames = (leases: LeaseRow[]) => {
    const l = activeLease(leases);
    return l ? l.renters.map((r) => `${r.person.firstName} ${r.person.lastName}`).join(", ") : "";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("units.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("units.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" render={<a href="/api/export/units" />}>
            {t("common.exportCsv")}
          </Button>
          <ImportDialog entity="unit" />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {units.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">{t("units.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("fields.label")}</TableHead>
                  <TableHead>{t("fields.type")}</TableHead>
                  <TableHead>{t("units.property")}</TableHead>
                  <TableHead>{t("units.building")}</TableHead>
                  <TableHead className="text-right">{t("fields.area")}</TableHead>
                  <TableHead>{t("units.status")}</TableHead>
                  <TableHead>{t("units.tenant")}</TableHead>
                  <TableHead className="w-24 text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {units.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      <Link href={`/units/${u.id}`} className="hover:underline">
                        {u.label}
                      </Link>
                    </TableCell>
                    <TableCell>{t(`unitType.${u.type}`)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {u.building.property.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.building.name}</TableCell>
                    <TableCell className="text-right">{String(u.area)}</TableCell>
                    <TableCell>
                      {occupied(u.leases) ? (
                        <Badge variant="secondary">{t("units.occupied")}</Badge>
                      ) : (
                        <Badge variant="outline">{t("units.vacant")}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {tenantNames(u.leases) || <span className="text-xs">{t("common.none")}</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {!occupied(u.leases) && (
                          <LeaseDialog
                            presetUnitId={u.id}
                            persons={personOpts}
                            customDefs={leaseDefs}
                            triggerLabel={t("units.assignTenant")}
                          />
                        )}
                        <UnitDialog
                          buildingId={u.buildingId}
                          customDefs={customDefs}
                          unit={{
                            id: u.id,
                            label: u.label,
                            type: u.type,
                            area: String(u.area),
                            rooms: u.rooms ? String(u.rooms) : undefined,
                            mea: u.mea != null ? String(u.mea) : undefined,
                            custom: (u.custom as Record<string, string>) ?? {},
                          }}
                        />
                        <DeleteButton action={deleteUnit} id={u.id} />
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
