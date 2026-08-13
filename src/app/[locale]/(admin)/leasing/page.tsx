import { getTranslations, getLocale } from "next-intl/server";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { date } from "@/lib/format";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SOON_DAYS = 90;

export default async function LeasingPage() {
  const user = await requireUser();
  const t = await getTranslations();
  const locale = await getLocale();
  const now = new Date();
  const soon = new Date(now.getTime() + SOON_DAYS * 86_400_000);

  const [units, endingLeases, interessenten, areaProps] = await Promise.all([
    // Einheiten mit aktiven Verträgen (für Leerstand-Ermittlung)
    prisma.unit.findMany({
      where: { tenantId: user.tenantId, building: { property: { areaModel: false } } },
      include: {
        building: { include: { property: { select: { name: true } } } },
        leases: { select: { startDate: true, endDate: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    // Verträge, die in den nächsten 90 Tagen enden → künftiger Leerstand
    prisma.lease.findMany({
      where: { tenantId: user.tenantId, endDate: { gte: now, lte: soon } },
      include: {
        unit: { include: { building: { include: { property: { select: { name: true } } } } } },
        renters: { include: { person: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { endDate: "asc" },
    }),
    prisma.person.findMany({
      where: { tenantId: user.tenantId, type: "INTERESSENT" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    // Flächenmodell-Objekte: Leerstandsfläche jetzt
    prisma.property.findMany({
      where: { tenantId: user.tenantId, areaModel: true },
      include: { areaAllocations: true },
    }),
  ]);

  const vacantUnits = units.filter(
    (u) => !u.leases.some((l) => l.startDate <= now && (!l.endDate || l.endDate >= now)),
  );

  const areaVacancy = areaProps.map((p) => {
    const occupied = p.areaAllocations
      .filter((a) => !a.outdoor && a.from <= now && (!a.to || a.to >= now))
      .reduce((s, a) => s + Number(a.area), 0);
    return { name: p.name, vacancy: Math.max(0, Number(p.totalArea ?? 0) - occupied) };
  }).filter((p) => p.vacancy > 0.01);

  const hasVacancy = vacantUnits.length > 0 || endingLeases.length > 0 || areaVacancy.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("leasing.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("leasing.subtitle")}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Leerstand & auslaufend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("leasing.vacancy")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!hasVacancy && <p className="text-sm text-muted-foreground">{t("leasing.noVacancy")}</p>}

            {vacantUnits.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">{t("leasing.vacantNow")}</div>
                {vacantUnits.map((u) => (
                  <Link
                    key={u.id}
                    href={`/units/${u.id}`}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted"
                  >
                    <span>
                      {u.building.property.name} · {u.label}
                    </span>
                    <Badge variant="outline">{Number(u.area).toFixed(0)} m²</Badge>
                  </Link>
                ))}
              </div>
            )}

            {areaVacancy.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">{t("leasing.vacantArea")}</div>
                {areaVacancy.map((p) => (
                  <div key={p.name} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span>{p.name}</span>
                    <Badge variant="outline">{p.vacancy.toFixed(2)} m²</Badge>
                  </div>
                ))}
              </div>
            )}

            {endingLeases.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">{t("leasing.endingSoon")}</div>
                {endingLeases.map((l) => (
                  <Link
                    key={l.id}
                    href={`/leases/${l.id}`}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted"
                  >
                    <span>
                      {l.unit.building.property.name} · {l.unit.label} ·{" "}
                      {l.renters.map((r) => `${r.person.firstName} ${r.person.lastName}`).join(", ")}
                    </span>
                    <Badge variant="secondary">{l.endDate ? date(l.endDate, locale) : ""}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mietinteressenten */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("leasing.interested")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {interessenten.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("leasing.noInterested")}</p>
            ) : (
              interessenten.map((p) => (
                <Link
                  key={p.id}
                  href={`/persons/${p.id}`}
                  className="block rounded-md border px-3 py-2 text-sm hover:bg-muted"
                >
                  <div className="font-medium">
                    {p.firstName} {p.lastName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {[p.email, p.phone].filter(Boolean).join(" · ")}
                    {p.note ? ` — ${p.note}` : ""}
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
