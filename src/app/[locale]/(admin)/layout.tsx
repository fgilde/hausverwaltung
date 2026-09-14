import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { readableForeground } from "@/lib/color";
import { NotificationBell } from "@/components/notification-bell";
import { InfoDrawer } from "@/components/info-drawer";
import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { SearchBox } from "@/components/search-box";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  // Portal-Rollen haben keinen Zugriff auf die Verwalter-App.
  if (["MIETER", "EIGENTUEMER", "HANDWERKER"].includes(user.role)) redirect("/portal");

  const locale = await getLocale();
  const t = await getTranslations();
  const [tenant, notifs, unread] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { name: true, brandColor: true, logoKey: true } }),
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.notification.count({ where: { userId: user.id, read: false } }),
  ]);
  const logoUrl = tenant?.logoKey ? "/api/logo" : undefined;
  const dtf = new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" });
  const notifItems = notifs.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    link: n.link,
    read: n.read,
    createdAt: dtf.format(n.createdAt),
  }));

  return (
    <SidebarProvider>
      {/* Mandanten-Branding: überschreibt die Primärfarbe inkl. lesbarem
          Vordergrund (sonst wirken Buttons je nach Farbe "ausgegraut"). */}
      {tenant?.brandColor && (
        <style>{`:root{--primary:${tenant.brandColor};--sidebar-primary:${tenant.brandColor};--ring:${tenant.brandColor};--primary-foreground:${readableForeground(tenant.brandColor)};--sidebar-primary-foreground:${readableForeground(tenant.brandColor)};}`}</style>
      )}
      <AppSidebar logoUrl={logoUrl} superAdmin={user.superAdmin} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-6" />
          <SearchBox />
          {user.superAdmin && user.tenantId !== user.homeTenantId && (
            <a
              href="/tenants"
              className="ml-2 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400"
              title={t("tenants.actingHint")}
            >
              ▸ {tenant?.name}
            </a>
          )}
          <div className="ml-auto flex items-center gap-1">
            <InfoDrawer tenantName={tenant?.name ?? "HaVeWa"} />
            <NotificationBell items={notifItems} unread={unread} />
            <LanguageSwitcher />
            <ThemeToggle />
            <UserMenu name={user.name} email={user.email} role={user.role} />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
