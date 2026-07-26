import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TemplateDialog } from "@/components/template-dialog";
import { DeleteButton } from "@/components/delete-button";
import { deleteTemplate } from "@/server/actions/templates";

const PLACEHOLDERS = [
  "mieter.name",
  "mieter.anrede",
  "objekt.name",
  "einheit.bezeichnung",
  "vertrag.kaltmiete",
  "datum",
];

export default async function TemplatesPage() {
  const user = await requireUser();
  const t = await getTranslations();

  const templates = await prisma.template.findMany({
    where: { tenantId: user.tenantId },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("templates.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("templates.subtitle")}</p>
        </div>
        <TemplateDialog />
      </div>

      {/* Platzhalter-Referenz */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("templates.placeholders")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {PLACEHOLDERS.map((p) => (
            <code key={p} className="rounded bg-muted px-2 py-1 text-xs">{`{{${p}}}`}</code>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {templates.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">{t("templates.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("fields.name")}</TableHead>
                  <TableHead>{t("templates.category")}</TableHead>
                  <TableHead>{t("templates.subject")}</TableHead>
                  <TableHead className="w-24 text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((tpl) => (
                  <TableRow key={tpl.id}>
                    <TableCell className="font-medium">{tpl.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{t(`templateCategory.${tpl.category}`)}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{tpl.subject ?? t("common.none")}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <TemplateDialog
                          template={{
                            id: tpl.id,
                            category: tpl.category,
                            name: tpl.name,
                            subject: tpl.subject,
                            body: tpl.body,
                          }}
                        />
                        <DeleteButton action={deleteTemplate} id={tpl.id} />
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
