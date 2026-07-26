import { getTranslations, getLocale } from "next-intl/server";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
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
import { InsuranceDialog } from "@/components/niche-dialogs";
import { DeleteButton } from "@/components/delete-button";
import { deleteInsurance } from "@/server/actions/niche";

export default async function InsurancePage() {
  const user = await requireUser();
  const t = await getTranslations();
  const locale = await getLocale();
  const tenantId = user.tenantId;
  const now = new Date();

  const [insurances, properties] = await Promise.all([
    prisma.insurance.findMany({
      where: { tenantId },
      include: { property: { select: { name: true } } },
      orderBy: [{ property: { name: "asc" } }, { type: "asc" }],
    }),
    prisma.property.findMany({ where: { tenantId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const propertyOpts = properties.map((p) => ({ value: p.id, label: p.name }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("insurance.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("insurance.subtitle")}</p>
        </div>
        {propertyOpts.length > 0 && <InsuranceDialog properties={propertyOpts} />}
      </div>

      <Card>
        <CardContent className="p-0">
          {insurances.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">{t("insurance.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("units.property")}</TableHead>
                  <TableHead>{t("fields.type")}</TableHead>
                  <TableHead>{t("insurance.insurer")}</TableHead>
                  <TableHead>{t("insurance.policyNo")}</TableHead>
                  <TableHead className="text-right">{t("insurance.premium")}</TableHead>
                  <TableHead>{t("insurance.end")}</TableHead>
                  <TableHead className="w-16 text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {insurances.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{i.property.name}</TableCell>
                    <TableCell>{t(`insuranceType.${i.type}`)}</TableCell>
                    <TableCell>{i.insurer}</TableCell>
                    <TableCell className="text-muted-foreground">{i.policyNo ?? t("common.none")}</TableCell>
                    <TableCell className="text-right">{money(Number(i.premium), locale)}</TableCell>
                    <TableCell>
                      {i.endDate ? (
                        <span className={i.endDate < now ? "text-destructive" : ""}>{date(i.endDate, locale)}</span>
                      ) : (
                        <Badge variant="outline">{t("leases.unlimited")}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <DeleteButton action={deleteInsurance} id={i.id} />
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
