import { ArrowLeft, Gauge, FileSignature } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { money, date } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
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
import { MeterDialog, ReadingDialog } from "@/components/entity-dialogs";
import { LeaseDialog } from "@/components/lease-dialogs";
import { DeleteButton } from "@/components/delete-button";
import { deleteMeter, deleteReading } from "@/server/actions/objects";

export default async function UnitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const t = await getTranslations();
  const locale = await getLocale();

  const unit = await prisma.unit.findFirst({
    where: { id, tenantId: user.tenantId },
    include: {
      building: { include: { property: true } },
      leases: {
        orderBy: { startDate: "desc" },
        include: { renters: { include: { person: true } } },
      },
      meters: {
        orderBy: { createdAt: "asc" },
        include: { readings: { orderBy: { date: "desc" } } },
      },
    },
  });

  if (!unit) notFound();

  const persons = await prisma.person.findMany({
    where: { tenantId: user.tenantId },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  const personOpts = persons.map((p) => ({ value: p.id, label: `${p.lastName}, ${p.firstName}` }));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Button
          variant="ghost"
          size="sm"
          render={<Link href={`/properties/${unit.building.propertyId}`} />}
        >
          <ArrowLeft className="size-4" />
          {unit.building.property.name}
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">{unit.label}</h1>
        <div className="flex flex-wrap gap-2 pt-1 text-sm text-muted-foreground">
          <Badge variant="outline">{t(`unitType.${unit.type}`)}</Badge>
          <span>
            {String(unit.area)} m²
            {unit.rooms ? ` · ${String(unit.rooms)} ${t("fields.rooms")}` : ""}
            {unit.mea != null ? ` · MEA ${unit.mea}` : ""}
          </span>
        </div>
      </div>

      {/* Mietverhältnisse */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSignature className="size-4" />
            {t("leases.title")}
          </CardTitle>
          <LeaseDialog presetUnitId={unit.id} persons={personOpts} triggerLabel={t("leases.new")} />
        </CardHeader>
        <CardContent className="space-y-2">
          {unit.leases.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("leases.empty")}</p>
          ) : (
            unit.leases.map((l) => (
              <Link
                key={l.id}
                href={`/leases/${l.id}`}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted"
              >
                <span className="font-medium">
                  {l.renters.map((r) => `${r.person.firstName} ${r.person.lastName}`).join(", ") ||
                    t("common.none")}
                </span>
                <span className="text-muted-foreground">
                  {money(Number(l.rentCold), locale)} · {date(l.startDate, locale)}
                  {l.endDate ? ` – ${date(l.endDate, locale)}` : ""}
                </span>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Gauge className="size-4" />
            {t("unitDetail.meters")}
          </CardTitle>
          <MeterDialog unitId={unit.id} />
        </CardHeader>
        <CardContent className="space-y-6">
          {unit.meters.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("unitDetail.noMeters")}</p>
          ) : (
            unit.meters.map((m) => (
              <div key={m.id} className="rounded-lg border">
                <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{t(`meterType.${m.type}`)}</Badge>
                    <span className="text-sm font-medium">{m.serialNo}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ReadingDialog meterId={m.id} />
                    <DeleteButton action={deleteMeter} id={m.id} />
                  </div>
                </div>
                {m.readings.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-muted-foreground">
                    {t("unitDetail.noReadings")}
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("fields.date")}</TableHead>
                        <TableHead className="text-right">{t("fields.value")}</TableHead>
                        <TableHead className="w-16 text-right">{t("common.actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {m.readings.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>{r.date.toISOString().slice(0, 10)}</TableCell>
                          <TableCell className="text-right">{String(r.value)}</TableCell>
                          <TableCell>
                            <div className="flex justify-end">
                              <DeleteButton action={deleteReading} id={r.id} />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
