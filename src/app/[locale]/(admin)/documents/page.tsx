import { Download, FileText } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { date } from "@/lib/format";
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
import { DeleteButton } from "@/components/delete-button";
import { deleteDocument } from "@/server/actions/documents";

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function DocumentsPage() {
  const user = await requireUser();
  const t = await getTranslations();
  const locale = await getLocale();
  const tenantId = user.tenantId;

  const [documents, properties] = await Promise.all([
    prisma.document.findMany({
      where: { tenantId },
      include: { property: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.property.findMany({ where: { tenantId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
  ]);
  const propertyOpts = properties.map((p) => ({ value: p.id, label: p.name }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("documents.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("documents.subtitle")}</p>
        </div>
        <DocumentDialog properties={propertyOpts} />
      </div>

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
                  <TableHead>{t("units.property")}</TableHead>
                  <TableHead className="text-right">{t("documents.size")}</TableHead>
                  <TableHead>{t("fields.date")}</TableHead>
                  <TableHead className="w-24 text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        <FileText className="size-4 text-muted-foreground" />
                        {d.name}
                        {d.eInvoice && <Badge variant="secondary">{t("documents.eInvoice")}</Badge>}
                      </span>
                    </TableCell>
                    <TableCell>{t(`documentCategory.${d.category}`)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {d.property?.name ?? t("common.none")}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{fmtSize(d.size)}</TableCell>
                    <TableCell>{date(d.createdAt, locale)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" aria-label={t("documents.download")} render={<a href={`/api/documents/${d.id}`} />}>
                          <Download className="size-4" />
                        </Button>
                        <DeleteButton action={deleteDocument} id={d.id} />
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
