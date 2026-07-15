import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
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
import { UnitDialog } from "@/components/entity-dialogs";
import { DeleteButton } from "@/components/delete-button";
import { deleteUnit } from "@/server/actions/objects";

export default async function UnitsPage() {
  const user = await requireUser();
  const t = await getTranslations();

  const units = await prisma.unit.findMany({
    where: { tenantId: user.tenantId },
    include: {
      building: { include: { property: true } },
      leases: { select: { startDate: true, endDate: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const now = new Date();
  const occupied = (leases: { startDate: Date; endDate: Date | null }[]) =>
    leases.some((l) => l.startDate <= now && (!l.endDate || l.endDate >= now));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("units.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("units.subtitle")}</p>
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
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <UnitDialog
                          buildingId={u.buildingId}
                          unit={{
                            id: u.id,
                            label: u.label,
                            type: u.type,
                            area: String(u.area),
                            rooms: u.rooms ? String(u.rooms) : undefined,
                            mea: u.mea != null ? String(u.mea) : undefined,
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
