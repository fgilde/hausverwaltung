import { getTranslations, getLocale } from "next-intl/server";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { money } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PropertyTaxDialog } from "@/components/niche-dialogs";
import { Button } from "@/components/ui/button";
import { bookGrundsteuerAsCost } from "@/server/actions/niche";

export default async function GrundsteuerPage() {
  const user = await requireUser();
  const t = await getTranslations();
  const locale = await getLocale();

  const properties = await prisma.property.findMany({
    where: { tenantId: user.tenantId },
    include: { propertyTax: true },
    orderBy: { name: "asc" },
  });

  const jahr = (mess?: number | null, hebe?: number | null) =>
    mess && hebe ? Math.round(((mess * hebe) / 100) * 100) / 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("grundsteuer.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("grundsteuer.subtitle")}</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {properties.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">{t("dashboard.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("units.property")}</TableHead>
                  <TableHead>{t("grundsteuer.aktenzeichen")}</TableHead>
                  <TableHead className="text-right">{t("grundsteuer.messbetrag")}</TableHead>
                  <TableHead className="text-right">{t("grundsteuer.hebesatz")}</TableHead>
                  <TableHead className="text-right">{t("grundsteuer.yearly")}</TableHead>
                  <TableHead className="w-16 text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {properties.map((p) => {
                  const tax = p.propertyTax;
                  const mess = tax?.messbetrag ? Number(tax.messbetrag) : null;
                  const hebe = tax?.hebesatz ? Number(tax.hebesatz) : null;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-muted-foreground">{tax?.aktenzeichen ?? t("common.none")}</TableCell>
                      <TableCell className="text-right">{mess ? money(mess, locale) : t("common.none")}</TableCell>
                      <TableCell className="text-right">{hebe ? `${hebe} %` : t("common.none")}</TableCell>
                      <TableCell className="text-right font-medium">{money(jahr(mess, hebe), locale)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {mess && hebe ? (
                            <form action={bookGrundsteuerAsCost}>
                              <input type="hidden" name="propertyId" value={p.id} />
                              <Button type="submit" variant="ghost" size="sm" title={t("niche.bookAsCostHint")}>
                                {t("niche.bookAsCost")}
                              </Button>
                            </form>
                          ) : null}
                          <PropertyTaxDialog
                            propertyId={p.id}
                            tax={
                              tax
                                ? {
                                    aktenzeichen: tax.aktenzeichen,
                                    grundsteuerwert: tax.grundsteuerwert ? String(tax.grundsteuerwert) : null,
                                    messbetrag: tax.messbetrag ? String(tax.messbetrag) : null,
                                    hebesatz: tax.hebesatz ? String(tax.hebesatz) : null,
                                    note: tax.note,
                                  }
                                : undefined
                            }
                          />
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
