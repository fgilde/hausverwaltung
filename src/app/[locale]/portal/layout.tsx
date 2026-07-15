import { requireUser } from "@/lib/rbac";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="min-h-svh bg-muted/30">
      <header className="flex h-14 items-center gap-2 border-b bg-background px-4">
        <Link href="/portal" className="flex items-center gap-2 font-semibold">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.png" alt="HaVeWa" className="size-7 rounded-md" />
          HaVeWa
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
          <UserMenu name={user.name} email={user.email} role={user.role} />
        </div>
      </header>
      <div className="mx-auto max-w-4xl p-4 md:p-6">{children}</div>
    </div>
  );
}
