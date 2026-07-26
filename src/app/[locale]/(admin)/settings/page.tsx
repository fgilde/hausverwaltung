import { headers } from "next/headers";
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
import { UserDialog, ResetPasswordDialog } from "@/components/user-dialogs";
import { SettingsConfig } from "@/components/settings-config";
import { BrandingConfig } from "@/components/branding-config";
import { CustomFieldDialog } from "@/components/custom-field-dialog";
import { ApiTokensManager } from "@/components/api-tokens-manager";
import { IntegrationInfo } from "@/components/integration-info";
import { TenantNameForm } from "@/components/tenant-name-form";
import { SettingsTabs, type SettingsTab } from "@/components/settings-tabs";
import { DeleteButton } from "@/components/delete-button";
import { deleteUser } from "@/server/actions/users";
import { deleteCustomFieldDef } from "@/server/actions/custom-fields";

export default async function SettingsPage() {
  const user = await requireUser();
  const t = await getTranslations();

  const isAdmin = user.role === "ADMIN";
  const [tenant, users, persons, customDefs, tokens] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: user.tenantId } }),
    prisma.user.findMany({ where: { tenantId: user.tenantId }, orderBy: { createdAt: "asc" } }),
    prisma.person.findMany({ where: { tenantId: user.tenantId }, orderBy: { lastName: "asc" } }),
    prisma.customFieldDef.findMany({ where: { tenantId: user.tenantId }, orderBy: { createdAt: "asc" } }),
    prisma.apiToken.findMany({
      where: { tenantId: user.tenantId, ...(isAdmin ? {} : { userId: user.id }) },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const roles = assignableRoles(user.role);
  const canManage = roles.length > 0;
  const roleOptions = roles.map((r) => ({ value: r, label: t(`userRole.${r}`) }));
  const personOptions = persons.map((p) => ({ value: p.id, label: `${p.firstName} ${p.lastName}` }));
  const tokenRows = tokens.map((tk) => ({
    id: tk.id,
    name: tk.name,
    prefix: tk.prefix,
    userName: tk.user.name,
    createdAt: tk.createdAt.toISOString().slice(0, 10),
    lastUsedAt: tk.lastUsedAt ? tk.lastUsedAt.toISOString().slice(0, 10) : null,
    revoked: !!tk.revokedAt,
  }));
  const tokenUserOpts = users.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }));

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = `${proto}://${host}`;

  const generalContent = (
    <>
      <TenantNameForm name={tenant?.name ?? ""} editable={isAdmin} />
      {isAdmin && tenant && <BrandingConfig brandColor={tenant.brandColor} hasLogo={!!tenant.logoKey} />}
    </>
  );

  const usersContent = (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">{t("settings.users")}</CardTitle>
          {canManage && <p className="mt-1 text-xs text-muted-foreground">{t("settings.usersHint")}</p>}
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
                    <div className="flex justify-end gap-1">
                      {(u.id === user.id || assignableRoles(user.role).includes(u.role)) && (
                        <ResetPasswordDialog id={u.id} />
                      )}
                      {canDeleteUser(user, u.role, u.id) && <DeleteButton action={deleteUser} id={u.id} />}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  const apiContent = (
    <>
      <ApiTokensManager tokens={tokenRows} users={tokenUserOpts} isAdmin={isAdmin} />
      <IntegrationInfo baseUrl={baseUrl} />
    </>
  );

  const advancedContent = (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">{t("customFields.title")}</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">{t("customFields.subtitle")}</p>
        </div>
        {canManage && <CustomFieldDialog />}
      </CardHeader>
      <CardContent className="space-y-2">
        {customDefs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("customFields.empty")}</p>
        ) : (
          customDefs.map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <div>
                <span className="font-medium">{d.label}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {t(`customFieldEntity.${d.entity}`)} · <code>{d.key}</code>
                </span>
              </div>
              {canManage && <DeleteButton action={deleteCustomFieldDef} id={d.id} />}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );

  const cfgProps = tenant
    ? {
        ai: { provider: tenant.aiProvider, baseUrl: tenant.aiBaseUrl, model: tenant.aiModel, hasKey: !!tenant.aiApiKey },
        smtp: { host: tenant.smtpHost, port: tenant.smtpPort, user: tenant.smtpUser, from: tenant.smtpFrom, secure: tenant.smtpSecure, hasPassword: !!tenant.smtpPassword },
      }
    : null;

  // KI-Assistent + API/MCP in einem Tab.
  const integrationContent = (
    <>
      {isAdmin && cfgProps && <SettingsConfig section="ai" ai={cfgProps.ai} smtp={cfgProps.smtp} />}
      {apiContent}
    </>
  );

  const tabs: SettingsTab[] = [{ value: "general", label: t("settings.tabGeneral"), content: generalContent }];
  tabs.push({ value: "integration", label: t("settings.tabIntegration"), content: integrationContent });
  if (isAdmin && cfgProps) {
    tabs.push({
      value: "email",
      label: t("settings.tabEmail"),
      content: <SettingsConfig section="smtp" ai={cfgProps.ai} smtp={cfgProps.smtp} />,
    });
  }
  tabs.push({ value: "users", label: t("settings.tabUsers"), content: usersContent });
  tabs.push({ value: "advanced", label: t("settings.tabAdvanced"), content: advancedContent });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("settings.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("settings.subtitle")}</p>
      </div>
      <SettingsTabs tabs={tabs} />
    </div>
  );
}
