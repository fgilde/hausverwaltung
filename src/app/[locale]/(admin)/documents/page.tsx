import { Download, FileText } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { date, money } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DocumentDialog } from "@/components/document-dialog";
import { DocumentPreview } from "@/components/document-preview";
import { DeleteButton } from "@/components/delete-button";
import { deleteDocument } from "@/server/actions/documents";

const CATS = ["VERTRAG", "RECHNUNG", "ERECHNUNG", "PROTOKOLL", "ABRECHNUNG", "SONSTIGES"];

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const t = await getTranslations();
  const locale = await getLocale();
  const tenantId = user.tenantId;
  const q = (sp.q ?? "").trim();
  const cat = sp.cat && CATS.includes(sp.cat) ? sp.cat : "";

  const [documents, properties, units, persons] = await Promise.all([
    prisma.document.findMany({
      where: {
        tenantId,
        ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
        ...(cat ? { category: cat as never } : {}),
      },
      include: {
        property: { select: { name: true } },
        unit: { select: { label: true } },
        person: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.property.findMany({ where: { tenantId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
    prisma.unit.findMany({
      where: { tenantId },
      include: { building: { include: { property: { select: { name: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.person.findMany({ where: { tenantId }, orderBy: { lastName: "asc" }, select: { id: true, firstName: true, lastName: true } }),
  ]);
  const propertyOpts = properties.map((p) => ({ value: p.id, label: p.name }));
  const unitOpts = units.map((u) => ({ value: u.id, label: `${u.building.property.name} · ${u.label}` }));
  const personOpts = persons.map((p) => ({ value: p.id, label: `${p.firstName} ${p.lastName}` }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("documents.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("documents.subtitle")}</p>
        </div>
        <DocumentDialog properties={propertyOpts} units={unitOpts} persons={personOpts} />
      </div>

      {/* Filter */}
      <form className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">{t("common.search")}</label>
          <input
            name="q"
            defaultValue={q}
            placeholder={t("documents.searchPlaceholder")}
            className="flex h-9 w-56 rounded-lg border border-input bg-transparent px-3 text-sm dark:bg-input/30"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">{t("documents.category")}</label>
          <select name="cat" defaultValue={cat} className="flex h-9 rounded-lg border border-input bg-transparent px-3 text-sm dark:bg-input/30">
            <option value="">{t("common.all")}</option>
            {CATS.map((c) => (
              <option key={c} value={c}>{t(`documentCategory.${c}`)}</option>
            ))}
          </select>
        </div>
        <Button type="submit" size="sm" variant="outline">{t("common.search")}</Button>
      </form>

      <Card>
        <CardContent className="p-0">
          {documents.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">{t("documents.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("fields.name")}</TableHead>
                  <TableHead>{t("documents.category")}</TableHead>
                  <TableHead>{t("documents.linkedTo")}</TableHead>
                  <TableHead className="text-right">{t("documents.size")}</TableHead>
                  <TableHead>{t("fields.date")}</TableHead>
                  <TableHead className="w-28 text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((d) => {
                  const linked = [
                    d.property?.name,
                    d.unit?.label,
                    d.person ? `${d.person.firstName} ${d.person.lastName}` : null,
                  ].filter(Boolean).join(" · ");
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-2">
                          <FileText className="size-4 text-muted-foreground" />
                          {d.name}
                          {d.eInvoice && <Badge variant="secondary">{t("documents.eInvoice")}</Badge>}
                        </span>
                        {(d.invoiceNo || d.invoiceTotal) && (
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {d.invoiceNo ? `Nr. ${d.invoiceNo}` : ""}
                            {d.invoiceNo && d.invoiceTotal ? " · " : ""}
                            {d.invoiceTotal ? money(Number(d.invoiceTotal), locale) : ""}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{t(`documentCategory.${d.category}`)}</TableCell>
                      <TableCell className="text-muted-foreground">{linked || t("common.none")}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{fmtSize(d.size)}</TableCell>
                      <TableCell>{date(d.createdAt, locale)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <DocumentPreview id={d.id} name={d.name} />
                          <Button variant="ghost" size="icon" aria-label={t("documents.download")} render={<a href={`/api/documents/${d.id}`} />}>
                            <Download className="size-4" />
                          </Button>
                          <DeleteButton action={deleteDocument} id={d.id} />
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
