import { redirect } from "next/navigation";
import { requireUser } from "@/lib/rbac";
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

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-6" />
          <SearchBox />
          <div className="ml-auto flex items-center gap-1">
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
