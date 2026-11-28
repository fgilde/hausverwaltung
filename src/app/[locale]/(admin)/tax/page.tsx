import { getTranslations } from "next-intl/server";
import { Download, Printer } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { computeAnlageV } from "@/server/tax";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnlageVTable, AnlageVNotes } from "@/components/anlage-v-table";

// Steuer (#103): Anlage-V-Übersicht je Objekt und Jahr.
export default async function TaxPage({ searchParams }: { searchParams: Promise<{ propertyId?: string; year?: string }> }) {
  const sp = await searchParams;
  const user = await requireRole(["VERWALTER", "BUCHHALTUNG"]);
  const t = await getTranslations();
  const properties = await prisma.property.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  const propertyId = sp.propertyId || properties[0]?.id;
  const year = Number(sp.year) || new Date().getFullYear() - 1;
  const data = propertyId ? await computeAnlageV(user.tenantId, propertyId, year) : null;
  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);
  const q = `propertyId=${propertyId}&year=${year}`;
  const select = "flex h-9 rounded-lg border border-input bg-transparent px-3 text-sm dark:bg-input/30";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("tax.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("tax.subtitle")}</p>
        </div>
        {data && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" render={<a href={`/api/export/anlage-v?${q}`} />}>
              <Download className="size-4" />
              CSV
            </Button>
            <Button variant="outline" size="sm" render={<a href={`/print/anlage-v?${q}`} target="_blank" rel="noopener noreferrer" />}>
              <Printer className="size-4" />
              {t("print.printPdf")}
            </Button>
          </div>
        )}
      </div>

      <form className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="propertyId" className="text-xs text-muted-foreground">{t("statements.selectProperty")}</label>
          <select id="propertyId" name="propertyId" defaultValue={propertyId} className={select}>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="year" className="text-xs text-muted-foreground">{t("statements.year")}</label>
          <select id="year" name="year" defaultValue={year} className={select}>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <Button type="submit" size="sm" variant="outline">{t("common.search")}</Button>
      </form>

      {data ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("tax.anlageV", { year: String(year) })}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AnlageVTable data={data} />
            <AnlageVNotes data={data} className="text-xs text-muted-foreground" />
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">{t("tax.noProperty")}</p>
      )}
    </div>
  );
}
