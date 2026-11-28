import { getTranslations, getLocale } from "next-intl/server";
import { FileText, Printer } from "lucide-react";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { money } from "@/lib/format";
import { computeStatement } from "@/server/statements";
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
import { CostDialog } from "@/components/cost-dialog";
import { LinkedDocs } from "@/components/document-dialog";
import { DeleteButton } from "@/components/delete-button";
import { deleteCost } from "@/server/actions/costs";
import { StatementActions } from "@/components/statement-actions";
import { ExplainStatement } from "@/components/explain-statement";

export default async function StatementsPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string; year?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const t = await getTranslations();
  const locale = await getLocale();
  const tenantId = user.tenantId;

  const properties = await prisma.property.findMany({
    where: { tenantId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  const propertyId = sp.propertyId || properties[0]?.id;
  const year = Number(sp.year) || new Date().getFullYear();

  const [st, subcommunities] = propertyId
    ? await Promise.all([
        computeStatement(tenantId, propertyId, year),
        prisma.subcommunity.findMany({ where: { tenantId, propertyId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
      ])
    : [null, []];
  const subOpts = subcommunities.map((s) => ({ value: s.id, label: s.name }));
  const subName = new Map(subcommunities.map((s) => [s.id, s.name]));
  const costRows = st?.costs ?? [];
  const lines = st?.units ?? [];
  const totalUmlage = st?.totalUmlage ?? 0;
  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("statements.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("statements.subtitle")}</p>
        </div>
        {propertyId && costRows.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            // PDF statt Druckansicht (#102): Übersicht + Einzelabrechnung je Mietverhältnis (#94)
            render={<a href={`/api/statements/pdf?propertyId=${propertyId}&year=${year}`} target="_blank" rel="noopener noreferrer" />}
          >
            <Printer className="size-4" />
            {t("print.printPdf")}
          </Button>
        )}
      </div>

      {/* Selektor */}
      <form className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">{t("statements.selectProperty")}</label>
          <select name="propertyId" defaultValue={propertyId} className="flex h-9 rounded-lg border border-input bg-transparent px-3 text-sm dark:bg-input/30">
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">{t("statements.year")}</label>
          <select name="year" defaultValue={year} className="flex h-9 rounded-lg border border-input bg-transparent px-3 text-sm dark:bg-input/30">
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <Button type="submit" size="sm" variant="outline">
          {t("common.search")}
        </Button>
      </form>

      {/* Kosten */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            {t("statements.costs")} · {t("statements.total")}: {money(totalUmlage, locale)}
          </CardTitle>
          {propertyId && <CostDialog propertyId={propertyId} year={year} subcommunities={subOpts} />}
        </CardHeader>
        <CardContent className="p-0">
          {costRows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">{t("statements.noCosts")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("fields.type")}</TableHead>
                  <TableHead>{t("statements.method")}</TableHead>
                  <TableHead>{t("statements.umlagefaehig")}</TableHead>
                  <TableHead className="text-right">{t("fields.amount")}</TableHead>
                  <TableHead className="w-16 text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costRows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      {t(`costType.${c.type}`)}
                      {c.note ? ` · ${c.note}` : ""}
                    </TableCell>
                    <TableCell>
                      {t(`allocationMethod.${c.method}`)}
                      {c.subcommunityId && <span className="text-muted-foreground"> · {subName.get(c.subcommunityId)}</span>}
                      {c.unitTypes.length > 0 && (
                        <span className="text-muted-foreground"> · {c.unitTypes.map((u) => t(`unitType.${u}`)).join(", ")}</span>
                      )}
                    </TableCell>
                    <TableCell>{c.umlagefaehig ? t("common.yes") : t("common.no")}</TableCell>
                    <TableCell className="text-right">{money(c.amount, locale)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        {/* Rechnungen zur Position (#99) */}
                        <LinkedDocs link={`cost:${c.id}`} count={c.documentCount} preset={{ propertyId, category: "RECHNUNG" }} />
                        <CostDialog propertyId={propertyId} year={year} subcommunities={subOpts} cost={c} />
                        <DeleteButton action={deleteCost} id={c.id} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Ergebnis */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">{t("statements.result")}</CardTitle>
            <p className="text-xs text-muted-foreground">{t("statements.hint")}</p>
          </div>
          {propertyId && lines.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <ExplainStatement propertyId={propertyId} year={year} />
              <StatementActions propertyId={propertyId} year={year} />
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {lines.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">{t("statements.noUnits")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("leases.unit")}</TableHead>
                  <TableHead className="text-right">{t("statements.allocated")}</TableHead>
                  <TableHead className="text-right">{t("statements.prepayment")}</TableHead>
                  <TableHead className="text-right">{t("statements.balance")}</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l) => (
                  <TableRow key={l.key}>
                    <TableCell className="font-medium">{l.label}</TableCell>
                    <TableCell className="text-right">{money(l.allocated, locale)}</TableCell>
                    <TableCell className="text-right">{money(l.prepayment, locale)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={l.balance >= 0 ? "secondary" : "destructive"}>
                        {money(l.balance, locale)} · {l.balance >= 0 ? t("statements.credit") : t("statements.arrears")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {l.leaseId && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("statements.singlePdf")}
                          title={t("statements.singlePdf")}
                          render={
                            <a
                              href={`/api/statements/pdf?propertyId=${propertyId}&year=${year}&key=${l.key}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            />
                          }
                        >
                          <FileText className="size-4" />
                        </Button>
                      )}
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
