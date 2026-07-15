import { getTranslations } from "next-intl/server";
import { requireUser, assignableRoles, canDeleteUser } from "@/lib/rbac";
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
import { UserDialog } from "@/components/user-dialogs";
import { SettingsConfig } from "@/components/settings-config";
import { DeleteButton } from "@/components/delete-button";
import { deleteUser } from "@/server/actions/users";

export default async function SettingsPage() {
  const user = await requireUser();
  const t = await getTranslations();

  const [tenant, users, persons] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: user.tenantId } }),
    prisma.user.findMany({ where: { tenantId: user.tenantId }, orderBy: { createdAt: "asc" } }),
    prisma.person.findMany({ where: { tenantId: user.tenantId }, orderBy: { lastName: "asc" } }),
  ]);
  const isAdmin = user.role === "ADMIN";

  const roles = assignableRoles(user.role);
  const canManage = roles.length > 0;
  const roleOptions = roles.map((r) => ({ value: r, label: t(`userRole.${r}`) }));
  const personOptions = persons.map((p) => ({ value: p.id, label: `${p.firstName} ${p.lastName}` }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("settings.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("settings.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings.tenant")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-lg font-medium">{tenant?.name}</div>
        </CardContent>
      </Card>

      {isAdmin && tenant && (
        <SettingsConfig
          ai={{ model: tenant.aiModel, hasKey: !!tenant.aiApiKey }}
          smtp={{
            host: tenant.smtpHost,
            port: tenant.smtpPort,
            user: tenant.smtpUser,
            from: tenant.smtpFrom,
            secure: tenant.smtpSecure,
            hasPassword: !!tenant.smtpPassword,
          }}
        />
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">{t("settings.users")}</CardTitle>
            {canManage && (
              <p className="mt-1 text-xs text-muted-foreground">{t("settings.usersHint")}</p>
            )}
          </div>
          {canManage && <UserDialog roles={roleOptions} persons={personOptions} />}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("fields.name")}</TableHead>
                <TableHead>{t("fields.email")}</TableHead>
                <TableHead>{t("settings.role")}</TableHead>
                {canManage && <TableHead className="w-16 text-right">{t("common.actions")}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    {u.name}
                    {u.id === user.id && (
                      <span className="ml-2 text-xs text-muted-foreground">({t("settings.you")})</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{t(`userRole.${u.role}`)}</Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <div className="flex justify-end">
                        {canDeleteUser(user, u.role, u.id) && (
                          <DeleteButton action={deleteUser} id={u.id} />
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
