import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Download } from "lucide-react";
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
import { PropertyDialog } from "@/components/entity-dialogs";
import { DeleteButton } from "@/components/delete-button";
import { deleteProperty } from "@/server/actions/objects";

export default async function PropertiesPage() {
  const user = await requireUser();
  const t = await getTranslations();

  const properties = await prisma.property.findMany({
    where: { tenantId: user.tenantId },
    include: { buildings: { include: { _count: { select: { units: true } } } } },
    orderBy: { createdAt: "asc" },
  });

  const unitCount = (p: (typeof properties)[number]) =>
    p.buildings.reduce((a, b) => a + b._count.units, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("properties.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("properties.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" render={<a href="/api/export/properties" />}>
            <Download className="size-4" />
            {t("common.exportCsv")}
          </Button>
          <PropertyDialog />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {properties.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">{t("properties.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("fields.name")}</TableHead>
                  <TableHead>{t("fields.type")}</TableHead>
                  <TableHead>{t("fields.management")}</TableHead>
                  <TableHead>{t("dashboard.location")}</TableHead>
                  <TableHead className="text-right">{t("properties.buildings")}</TableHead>
                  <TableHead className="text-right">{t("properties.units")}</TableHead>
                  <TableHead className="w-24 text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {properties.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      <Link href={`/properties/${p.id}`} className="hover:underline">
                        {p.name}
                      </Link>
                    </TableCell>
                    <TableCell>{t(`propertyType.${p.type}`)}</TableCell>
                    <TableCell>
                      <Badge variant={p.management === "WEG" ? "secondary" : "outline"}>
                        {t(`managementType.${p.management}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.zip} {p.city}
                    </TableCell>
                    <TableCell className="text-right">{p.buildings.length}</TableCell>
                    <TableCell className="text-right">{unitCount(p)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <PropertyDialog
                          property={{
                            id: p.id,
                            name: p.name,
                            street: p.street,
                            zip: p.zip,
                            city: p.city,
                            type: p.type,
                            management: p.management,
                          }}
                        />
                        <DeleteButton action={deleteProperty} id={p.id} />
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
