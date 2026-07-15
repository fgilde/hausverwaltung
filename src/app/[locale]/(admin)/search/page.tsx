import { getTranslations } from "next-intl/server";
import { Building2, DoorOpen, Users, FileSignature } from "lucide-react";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const t = await getTranslations();
  const tenantId = user.tenantId;
  const q = (sp.q ?? "").trim();

  const like = { contains: q, mode: "insensitive" as const };

  const [properties, units, persons, leases] = q
    ? await Promise.all([
        prisma.property.findMany({
          where: { tenantId, OR: [{ name: like }, { street: like }, { city: like }, { zip: like }] },
          take: 20,
        }),
        prisma.unit.findMany({
          where: { tenantId, label: like },
          include: { building: { include: { property: { select: { name: true } } } } },
          take: 20,
        }),
        prisma.person.findMany({
          where: { tenantId, OR: [{ firstName: like }, { lastName: like }, { email: like }] },
          take: 20,
        }),
        prisma.lease.findMany({
          where: {
            tenantId,
            OR: [
              { unit: { label: like } },
              { renters: { some: { person: { OR: [{ firstName: like }, { lastName: like }] } } } },
            ],
          },
          include: { unit: { select: { label: true } } },
          take: 20,
        }),
      ])
    : [[], [], [], []];

  const total = properties.length + units.length + persons.length + leases.length;

  const groups = [
    {
      key: "properties",
      icon: Building2,
      items: properties.map((p) => ({ id: p.id, label: p.name, sub: `${p.zip} ${p.city}`, href: `/properties/${p.id}` })),
    },
    {
      key: "units",
      icon: DoorOpen,
      items: units.map((u) => ({ id: u.id, label: u.label, sub: u.building.property.name, href: `/units/${u.id}` })),
    },
    {
      key: "persons",
      icon: Users,
      items: persons.map((p) => ({ id: p.id, label: `${p.firstName} ${p.lastName}`, sub: p.email ?? "", href: `/persons` })),
    },
    {
      key: "leases",
      icon: FileSignature,
      items: leases.map((l) => ({ id: l.id, label: l.unit.label, sub: t("nav.leases"), href: `/leases/${l.id}` })),
    },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("search.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {q ? t("search.resultsFor", { q, count: total }) : t("search.prompt")}
        </p>
      </div>

      {q && total === 0 && <p className="text-sm text-muted-foreground">{t("search.noResults")}</p>}

      <div className="grid gap-6 md:grid-cols-2">
        {groups.map((g) => (
          <Card key={g.key}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <g.icon className="size-4" />
                {t(`nav.${g.key}`)} ({g.items.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {g.items.map((it) => (
                <Link
                  key={it.id}
                  href={it.href}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <span className="font-medium">{it.label}</span>
                  {it.sub && <span className="text-xs text-muted-foreground">{it.sub}</span>}
                </Link>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
