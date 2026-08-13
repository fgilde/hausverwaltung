import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
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
import { PersonDialog } from "@/components/entity-dialogs";
import { ImportPersonsDialog } from "@/components/import-dialog";
import { DeleteButton } from "@/components/delete-button";
import { deletePerson } from "@/server/actions/persons";

const GROUPS = ["MIETER", "EIGENTUEMER", "INTERESSENT", "HANDWERKER", "MAKLER", "BANK", "SONSTIGE"] as const;

export default async function PersonsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const t = await getTranslations();
  const active = GROUPS.includes(sp.type as (typeof GROUPS)[number]) ? sp.type : undefined;

  const [persons, customDefs] = await Promise.all([
    prisma.person.findMany({
      where: { tenantId: user.tenantId, ...(active ? { type: active as (typeof GROUPS)[number] } : {}) },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.customFieldDef.findMany({
      where: { tenantId: user.tenantId, entity: "PERSON" },
      orderBy: { createdAt: "asc" },
      select: { key: true, label: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("persons.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("persons.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" render={<a href="/api/export/persons" />}>
            {t("common.exportCsv")}
          </Button>
          <ImportPersonsDialog />
          <PersonDialog customDefs={customDefs} />
        </div>
      </div>

      {/* Adressbuch-Gruppenfilter */}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={!active ? "default" : "outline"}
          render={<Link href="/persons" />}
        >
          {t("persons.allGroups")}
        </Button>
        {GROUPS.map((g) => (
          <Button
            key={g}
            size="sm"
            variant={active === g ? "default" : "outline"}
            render={<Link href={{ pathname: "/persons", query: { type: g } }} />}
          >
            {t(`personType.${g}`)}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {persons.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">{t("persons.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("fields.lastName")}</TableHead>
                  <TableHead>{t("fields.firstName")}</TableHead>
                  <TableHead>{t("persons.group")}</TableHead>
                  <TableHead>{t("fields.email")}</TableHead>
                  <TableHead>{t("fields.phone")}</TableHead>
                  <TableHead className="w-24 text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {persons.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      <Link href={`/persons/${p.id}`} className="hover:underline">
                        {p.lastName}
                      </Link>
                    </TableCell>
                    <TableCell>{p.firstName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{t(`personType.${p.type}`)}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.email ?? t("common.none")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.phone ?? t("common.none")}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <PersonDialog
                          customDefs={customDefs}
                          person={{
                            id: p.id,
                            firstName: p.firstName,
                            lastName: p.lastName,
                            email: p.email,
                            phone: p.phone,
                            type: p.type,
                            note: p.note,
                            custom: (p.custom as Record<string, string>) ?? {},
                          }}
                        />
                        <DeleteButton action={deletePerson} id={p.id} />
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
