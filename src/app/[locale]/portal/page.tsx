import { getTranslations, getLocale } from "next-intl/server";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { money, date } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CrudDialog } from "@/components/crud-dialog";
import { TextField, TextAreaField } from "@/components/form-fields";
import { reportIssue } from "@/server/actions/portal";

export default async function PortalPage() {
  const user = await requireUser();
  const t = await getTranslations();
  const locale = await getLocale();

  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { personId: true } });
  const personId = dbUser?.personId ?? "__none__";

  const [renters, owners] = await Promise.all([
    prisma.renter.findMany({
      where: { tenantId: user.tenantId, personId },
      include: {
        lease: {
          include: {
            unit: { include: { building: { include: { property: true } } } },
            components: true,
            charges: { include: { payments: { select: { amount: true } } }, orderBy: { dueDate: "desc" } },
          },
        },
      },
    }),
    prisma.owner.findMany({
      where: { tenantId: user.tenantId, personId },
      include: { unit: { include: { building: { include: { property: true } } } } },
    }),
  ]);

  const propertyIds = Array.from(
    new Set([
      ...renters.map((r) => r.lease.unit.building.propertyId),
      ...owners.map((o) => o.unit.building.propertyId),
    ]),
  );

  const [resolutions, documents] = await Promise.all([
    propertyIds.length
      ? prisma.resolution.findMany({ where: { tenantId: user.tenantId, propertyId: { in: propertyIds } }, orderBy: { number: "asc" } })
      : Promise.resolve([]),
    propertyIds.length
      ? prisma.document.findMany({ where: { tenantId: user.tenantId, propertyId: { in: propertyIds } }, orderBy: { createdAt: "desc" } })
      : Promise.resolve([]),
  ]);

  const now = new Date();
  const openItems = renters.flatMap((r) =>
    r.lease.charges
      .map((c) => {
        const paid = c.payments.reduce((a, p) => a + Number(p.amount), 0);
        return { c, open: Number(c.amount) - paid };
      })
      .filter((x) => x.open > 0.001),
  );

  const warm = (l: (typeof renters)[number]["lease"]) =>
    Number(l.rentCold) + l.components.reduce((a, c) => a + Number(c.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("portal.welcome")}, {user.name}
        </h1>
        <p className="text-sm text-muted-foreground">{user.role}</p>
      </div>

      {/* Mieter: Mietverhältnisse */}
      {renters.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">{t("portal.myLeases")}</CardTitle>
            <CrudDialog
              trigger={
                <Button size="sm">
                  <Plus className="size-4" />
                  {t("portal.report")}
                </Button>
              }
              title={t("portal.report")}
              action={reportIssue}
              submitLabel={t("common.create")}
            >
              <TextField name="title" label={t("portal.issueTitle")} />
              <TextAreaField name="description" label={t("rentComponent.note")} />
            </CrudDialog>
          </CardHeader>
          <CardContent className="space-y-2">
            {renters.map((r) => (
              <div key={r.id} className="rounded-md border px-3 py-2 text-sm">
                <div className="font-medium">
                  {r.lease.unit.building.property.name} · {r.lease.unit.label}
                </div>
                <div className="text-muted-foreground">
                  {t("leases.warmRent")}: {money(warm(r.lease), locale)} · {t("leases.start")}: {date(r.lease.startDate, locale)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Mieter: offene Posten */}
      {renters.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("portal.myOpenItems")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {openItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("portal.noOpenItems")}</p>
            ) : (
              openItems.map(({ c, open }) => (
                <div key={c.id} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t(`chargeType.${c.type}`)} · {date(c.period, locale)}
                  </span>
                  <span className="font-medium">{money(open, locale)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Eigentümer: Eigentum */}
      {owners.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("portal.myUnits")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {owners.map((o) => (
              <div key={o.id} className="rounded-md border px-3 py-2 text-sm">
                <div className="font-medium">
                  {o.unit.building.property.name} · {o.unit.label}
                </div>
                <div className="text-muted-foreground">
                  MEA {o.unit.mea ?? "—"} · {t("weg.share")}: {o.share}‰
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Eigentümer: Beschlüsse */}
      {owners.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("portal.resolutions")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {resolutions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("portal.noResolutions")}</p>
            ) : (
              resolutions.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-sm">
                  <span>
                    #{r.number} · {r.title}
                  </span>
                  <Badge variant={r.result === "ANGENOMMEN" ? "secondary" : "outline"}>
                    {t(`resolutionResult.${r.result}`)}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Dokumente */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("portal.myDocuments")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("portal.noDocuments")}</p>
          ) : (
            documents.map((d) => (
              <a
                key={d.id}
                href={`/api/documents/${d.id}`}
                className="flex justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted"
              >
                <span>{d.name}</span>
                <span className="text-muted-foreground">{t(`documentCategory.${d.category}`)}</span>
              </a>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
