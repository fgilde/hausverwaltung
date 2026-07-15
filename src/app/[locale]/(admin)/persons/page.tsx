import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
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
import { DeleteButton } from "@/components/delete-button";
import { deletePerson } from "@/server/actions/persons";

export default async function PersonsPage() {
  const user = await requireUser();
  const t = await getTranslations();

  const persons = await prisma.person.findMany({
    where: { tenantId: user.tenantId },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("persons.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("persons.subtitle")}</p>
        </div>
        <PersonDialog />
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
                  <TableHead>{t("fields.email")}</TableHead>
                  <TableHead>{t("fields.phone")}</TableHead>
                  <TableHead className="w-24 text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {persons.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.lastName}</TableCell>
                    <TableCell>{p.firstName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.email ?? t("common.none")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.phone ?? t("common.none")}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <PersonDialog
                          person={{
                            id: p.id,
                            firstName: p.firstName,
                            lastName: p.lastName,
                            email: p.email,
                            phone: p.phone,
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
