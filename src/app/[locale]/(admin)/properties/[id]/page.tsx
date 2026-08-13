import { ArrowLeft, Percent } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { money, date } from "@/lib/format";
import { computeMgmtFee, type FeeType } from "@/lib/fee";
import { buildAreaStatement, areaTimeWeights, VACANCY_ID } from "@/lib/allocation/area-time";
import { AreaAllocationDialog } from "@/components/area-dialogs";
import { deleteAreaAllocation } from "@/server/actions/area";
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
  const locale = await getLocale();

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

  // Verwalterhonorar: Basis aus Einheitenzahl + aktiver Sollmiete berechnen
  const now = new Date();
  const activeLeases = await prisma.lease.findMany({
    where: {
      tenantId: user.tenantId,
      unit: { building: { propertyId: id } },
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    },
    include: { components: { select: { amount: true } } },
  });
  const [customDefs, unitDefs] = await Promise.all([
    prisma.customFieldDef.findMany({
      where: { tenantId: user.tenantId, entity: "PROPERTY" },
      orderBy: { createdAt: "asc" },
      select: { key: true, label: true },
    }),
    prisma.customFieldDef.findMany({
      where: { tenantId: user.tenantId, entity: "UNIT" },
      orderBy: { createdAt: "asc" },
      select: { key: true, label: true },
    }),
  ]);
  const customValues = (property.custom as Record<string, string>) ?? {};

  const unitCount = property.buildings.reduce((a, b) => a + b.units.length, 0);
  const monthlyRentSum = activeLeases.reduce(
    (a, l) => a + Number(l.rentCold) + l.components.reduce((s, c) => s + Number(c.amount), 0),
    0,
  );
  const mgmtFee = computeMgmtFee(
    { feeType: property.feeType as FeeType, feeValue: Number(property.feeValue) },
    { unitCount, monthlyRentSum },
  );

  // Flächenmodell (Gewerbe): Teilflächen + m²·Tage-Abrechnung des laufenden Jahres.
  const areaYear = now.getUTCFullYear();
  const areaData = property.areaModel
    ? await (async () => {
        const [allocations, propLeases, areaCosts] = await Promise.all([
          prisma.areaAllocation.findMany({
            where: { tenantId: user.tenantId, propertyId: id },
            include: { lease: { include: { renters: { include: { person: true } } } } },
            orderBy: [{ outdoor: "asc" }, { from: "asc" }],
          }),
          prisma.lease.findMany({
            where: { tenantId: user.tenantId, unit: { building: { propertyId: id } } },
            include: { renters: { include: { person: true } } },
          }),
          prisma.costEntry.findMany({ where: { tenantId: user.tenantId, propertyId: id, year: areaYear } }),
        ]);
        const total = Number(property.totalArea ?? 0);
        const name = (a: (typeof allocations)[number]) =>
          a.label ||
          (a.lease ? a.lease.renters.map((r) => `${r.person.firstName} ${r.person.lastName}`).join(", ") : "") ||
          t("areaModel.vacancy");
        const slices = allocations.map((a) => ({
          id: a.id,
          area: Number(a.area),
          from: a.from,
          to: a.to,
          outdoor: a.outdoor,
        }));
        const stmt = buildAreaStatement(
          slices,
          total,
          areaCosts.map((c) => ({ id: c.id, amount: Number(c.amount), umlagefaehig: c.umlagefaehig })),
          new Date(Date.UTC(areaYear, 0, 1)),
          new Date(Date.UTC(areaYear, 11, 31)),
        );
        const w = areaTimeWeights(slices, total, new Date(Date.UTC(areaYear, 0, 1)), new Date(Date.UTC(areaYear, 11, 31)));
        const activePool = allocations
          .filter((a) => !a.outdoor && a.from <= now && (!a.to || a.to >= now))
          .reduce((s, a) => s + Number(a.area), 0);
        const leaseOpts = propLeases.map((l) => ({
          value: l.id,
          label: `${l.renters.map((r) => `${r.person.firstName} ${r.person.lastName}`).join(", ") || l.id}`,
        }));
        const nameById = new Map(allocations.map((a) => [a.id, name(a)]));
        return { allocations, total, stmt, w, activePool, leaseOpts, nameById };
      })()
    : null;

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
            customDefs={customDefs}
            property={{
              id: property.id,
              name: property.name,
              street: property.street,
              zip: property.zip,
              city: property.city,
              type: property.type,
              management: property.management,
              meaTotal: property.meaTotal,
              feeType: property.feeType,
              feeValue: String(property.feeValue),
              areaModel: property.areaModel,
              totalArea: property.totalArea != null ? String(property.totalArea) : undefined,
              custom: customValues,
            }}
          />
          <DeleteButton action={deleteProperty} id={property.id} />
        </div>
      </div>

      {/* Verwalterhonorar */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Percent className="size-4" />
            {t("fee.title")}
          </CardTitle>
          <span className="text-xs text-muted-foreground">{t(`feeType.${property.feeType}`)}</span>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {money(mgmtFee, locale)} <span className="text-sm font-normal text-muted-foreground">/ {t("fee.perMonth")}</span>
          </div>
        </CardContent>
      </Card>

      {areaData && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">{t("areaModel.title")}</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("areaModel.pool")}: {areaData.total.toFixed(2)} m² ·{" "}
                {t("units.occupied")}: {areaData.activePool.toFixed(2)} m² ·{" "}
                {t("areaModel.vacancy")}: {Math.max(0, areaData.total - areaData.activePool).toFixed(2)} m²{" "}
                {areaData.activePool <= areaData.total + 0.01 ? "✓" : "✗"}
              </p>
            </div>
            <AreaAllocationDialog propertyId={property.id} leases={areaData.leaseOpts} />
          </CardHeader>
          <CardContent className="space-y-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("areaModel.label")}</TableHead>
                  <TableHead className="text-right">{t("areaModel.area")}</TableHead>
                  <TableHead className="text-right">{t("areaModel.pricePerSqm")}</TableHead>
                  <TableHead>{t("areaModel.period")}</TableHead>
                  <TableHead className="w-16 text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {areaData.allocations.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">
                      {areaData.nameById.get(a.id)}
                      {a.outdoor && <Badge variant="outline" className="ml-2">{t("areaModel.outdoor")}</Badge>}
                    </TableCell>
                    <TableCell className="text-right">{Number(a.area).toFixed(2)} m²</TableCell>
                    <TableCell className="text-right">
                      {a.pricePerSqm != null ? money(Number(a.pricePerSqm), locale) : t("common.none")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {date(a.from, locale)} – {a.to ? date(a.to, locale) : "…"}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <AreaAllocationDialog
                          propertyId={property.id}
                          leases={areaData.leaseOpts}
                          allocation={{
                            id: a.id,
                            leaseId: a.leaseId,
                            label: a.label,
                            area: String(a.area),
                            pricePerSqm: a.pricePerSqm != null ? String(a.pricePerSqm) : null,
                            outdoor: a.outdoor,
                            from: a.from,
                            to: a.to,
                          }}
                        />
                        <DeleteButton action={deleteAreaAllocation} id={a.id} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div>
              <div className="mb-2 text-sm font-medium">{t("areaModel.statement", { year: areaYear })}</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("areaModel.label")}</TableHead>
                    <TableHead className="text-right">{t("areaModel.weight")}</TableHead>
                    <TableHead className="text-right">{t("statements.allocated")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {areaData.stmt.lines.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>{l.id === VACANCY_ID ? t("areaModel.vacancy") : areaData.nameById.get(l.id) ?? l.id}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{l.weight.toFixed(2)} m²</TableCell>
                      <TableCell className="text-right">{money(l.allocated, locale)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell className="font-medium">{t("statements.total")}</TableCell>
                    <TableCell />
                    <TableCell className="text-right font-medium">{money(areaData.stmt.totalUmlage, locale)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {customDefs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("customFields.title")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {customDefs.map((d) => (
              <div key={d.key} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{d.label}</span>
                <span>{customValues[d.key] || t("common.none")}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
                <UnitDialog buildingId={b.id} customDefs={unitDefs} />
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
                              customDefs={unitDefs}
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
        ))
      )}
    </div>
  );
}
