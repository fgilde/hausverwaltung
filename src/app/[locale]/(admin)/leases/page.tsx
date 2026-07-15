import { getTranslations, getLocale } from "next-intl/server";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { money, date } from "@/lib/format";
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
import { LeaseDialog } from "@/components/lease-dialogs";
import { DeleteButton } from "@/components/delete-button";
import { deleteLease } from "@/server/actions/leases";

export default async function LeasesPage() {
  const user = await requireUser();
  const t = await getTranslations();
  const locale = await getLocale();

  const [leases, units, persons] = await Promise.all([
    prisma.lease.findMany({
      where: { tenantId: user.tenantId },
      include: {
        unit: { include: { building: { include: { property: true } } } },
        renters: { include: { person: true } },
        components: { select: { amount: true } },
      },
      orderBy: { startDate: "desc" },
    }),
    prisma.unit.findMany({
      where: { tenantId: user.tenantId },
      include: { building: { include: { property: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.person.findMany({
      where: { tenantId: user.tenantId },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ]);

  const unitOpts = units.map((u) => ({
    value: u.id,
    label: `${u.building.property.name} · ${u.building.name} · ${u.label}`,
  }));
  const personOpts = persons.map((p) => ({ value: p.id, label: `${p.lastName}, ${p.firstName}` }));

  const now = new Date();
  const statusOf = (l: (typeof leases)[number]) => {
    if (l.startDate > now) return { key: "future", variant: "outline" as const };
    if (l.endDate && l.endDate < now) return { key: "ended", variant: "outline" as const };
    return { key: "active", variant: "secondary" as const };
  };
  const warm = (l: (typeof leases)[number]) =>
    Number(l.rentCold) + l.components.reduce((a, c) => a + Number(c.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("leases.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("leases.subtitle")}</p>
        </div>
        <LeaseDialog units={unitOpts} persons={personOpts} />
      </div>

      <Card>
        <CardContent className="p-0">
          {leases.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">{t("leases.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("leases.unit")}</TableHead>
                  <TableHead>{t("leases.tenant")}</TableHead>
                  <TableHead className="text-right">{t("leases.coldRent")}</TableHead>
                  <TableHead className="text-right">{t("leases.warmRent")}</TableHead>
                  <TableHead>{t("leases.start")}</TableHead>
                  <TableHead>{t("leases.status")}</TableHead>
                  <TableHead className="w-24 text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leases.map((l) => {
                  const st = statusOf(l);
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">
                        <Link href={`/leases/${l.id}`} className="hover:underline">
                          {l.unit.building.property.name} · {l.unit.label}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {l.renters.map((r) => `${r.person.firstName} ${r.person.lastName}`).join(", ") ||
                          t("common.none")}
                      </TableCell>
                      <TableCell className="text-right">{money(Number(l.rentCold), locale)}</TableCell>
                      <TableCell className="text-right">{money(warm(l), locale)}</TableCell>
                      <TableCell>{date(l.startDate, locale)}</TableCell>
                      <TableCell>
                        <Badge variant={st.variant}>{t(`leases.${st.key}`)}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <LeaseDialog
                            lease={{
                              id: l.id,
                              startDate: l.startDate,
                              endDate: l.endDate,
                              rentCold: String(l.rentCold),
                              personCount: l.personCount,
                              noticePeriodM: l.noticePeriodM,
                            }}
                          />
                          <DeleteButton action={deleteLease} id={l.id} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
