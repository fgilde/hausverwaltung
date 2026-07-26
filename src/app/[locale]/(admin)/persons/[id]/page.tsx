import { ArrowLeft, Mail, Phone } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { money, date } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PersonDialog } from "@/components/entity-dialogs";
import { LeaseDialog } from "@/components/lease-dialogs";

export default async function PersonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const t = await getTranslations();
  const locale = await getLocale();

  const person = await prisma.person.findFirst({
    where: { id, tenantId: user.tenantId },
    include: {
      renters: { include: { lease: { include: { unit: { include: { building: { include: { property: true } } } } } } } },
      owners: { include: { unit: { include: { building: { include: { property: true } } } } } },
    },
  });
  if (!person) notFound();

  const units = await prisma.unit.findMany({
    where: { tenantId: user.tenantId },
    include: { building: { include: { property: true } } },
    orderBy: { createdAt: "asc" },
  });
  const unitOpts = units.map((u) => ({
    value: u.id,
    label: `${u.building.property.name} · ${u.building.name} · ${u.label}`,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" render={<Link href="/persons" />}>
            <ArrowLeft className="size-4" />
            {t("persons.title")}
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">
            {person.firstName} {person.lastName}
          </h1>
          <div className="flex flex-wrap items-center gap-3 pt-1 text-sm text-muted-foreground">
            <Badge variant="outline">{t(`personType.${person.type}`)}</Badge>
            {person.email && (
              <span className="flex items-center gap-1">
                <Mail className="size-3.5" /> {person.email}
              </span>
            )}
            {person.phone && (
              <span className="flex items-center gap-1">
                <Phone className="size-3.5" /> {person.phone}
              </span>
            )}
          </div>
          {person.note && <p className="max-w-xl pt-2 text-sm">{person.note}</p>}
        </div>
        <PersonDialog
          person={{
            id: person.id,
            firstName: person.firstName,
            lastName: person.lastName,
            email: person.email,
            phone: person.phone,
            type: person.type,
            note: person.note,
          }}
        />
      </div>

      {/* Mietverhältnisse */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{t("persons.tenancies")}</CardTitle>
          <LeaseDialog units={unitOpts} presetPersonId={person.id} triggerLabel={t("leases.new")} />
        </CardHeader>
        <CardContent className="space-y-2">
          {person.renters.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("persons.noTenancies")}</p>
          ) : (
            person.renters.map((r) => (
              <Link
                key={r.id}
                href={`/leases/${r.leaseId}`}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted"
              >
                <span className="font-medium">
                  {r.lease.unit.building.property.name} · {r.lease.unit.label}
                </span>
                <span className="text-muted-foreground">
                  {money(Number(r.lease.rentCold), locale)} · {date(r.lease.startDate, locale)}
                </span>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      {/* Eigentum */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("persons.ownerships")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {person.owners.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("persons.noOwnerships")}</p>
          ) : (
            person.owners.map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span className="font-medium">
                  {o.unit.building.property.name} · {o.unit.label}
                </span>
                <span className="text-muted-foreground">
                  {t("weg.share")}: {o.share}‰ · MEA {o.unit.mea ?? "—"}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
