import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PropertyDialog,
  BuildingDialog,
  UnitDialog,
} from "@/components/entity-dialogs";
import { DeleteButton } from "@/components/delete-button";
import { deleteProperty, deleteBuilding, deleteUnit } from "@/server/actions/objects";

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const t = await getTranslations();

  const property = await prisma.property.findFirst({
    where: { id, tenantId: user.tenantId },
    include: {
      buildings: {
        orderBy: { createdAt: "asc" },
        include: { units: { orderBy: { createdAt: "asc" } } },
      },
    },
  });

  if (!property) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" render={<Link href="/properties" />}>
            <ArrowLeft className="size-4" />
            {t("properties.title")}
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">{property.name}</h1>
          <p className="text-sm text-muted-foreground">
            {property.street}, {property.zip} {property.city}
          </p>
          <div className="flex gap-2 pt-1">
            <Badge variant="outline">{t(`propertyType.${property.type}`)}</Badge>
            <Badge variant={property.management === "WEG" ? "secondary" : "outline"}>
              {t(`managementType.${property.management}`)}
            </Badge>
          </div>
        </div>
        <div className="flex gap-1">
          <PropertyDialog
            property={{
              id: property.id,
              name: property.name,
              street: property.street,
              zip: property.zip,
              city: property.city,
              type: property.type,
              management: property.management,
            }}
          />
          <DeleteButton action={deleteProperty} id={property.id} />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("properties.buildings")}</h2>
        <BuildingDialog propertyId={property.id} />
      </div>

      {property.buildings.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("buildings.empty")}</p>
      ) : (
        property.buildings.map((b) => (
          <Card key={b.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">{b.name}</CardTitle>
              <div className="flex items-center gap-1">
                <UnitDialog buildingId={b.id} />
                <BuildingDialog propertyId={property.id} building={{ id: b.id, name: b.name }} />
                <DeleteButton action={deleteBuilding} id={b.id} />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {b.units.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">{t("units.empty")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("fields.label")}</TableHead>
                      <TableHead>{t("fields.type")}</TableHead>
                      <TableHead className="text-right">{t("fields.area")}</TableHead>
                      <TableHead className="text-right">{t("fields.rooms")}</TableHead>
                      <TableHead className="text-right">MEA</TableHead>
                      <TableHead className="w-24 text-right">{t("common.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {b.units.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">
                          <Link href={`/units/${u.id}`} className="hover:underline">
                            {u.label}
                          </Link>
                        </TableCell>
                        <TableCell>{t(`unitType.${u.type}`)}</TableCell>
                        <TableCell className="text-right">{String(u.area)}</TableCell>
                        <TableCell className="text-right">
                          {u.rooms ? String(u.rooms) : t("common.none")}
                        </TableCell>
                        <TableCell className="text-right">{u.mea ?? t("common.none")}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <UnitDialog
                              buildingId={b.id}
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
        ))
      )}
    </div>
  );
}
