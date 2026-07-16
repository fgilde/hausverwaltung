import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { auth } from "@/auth";
import { LoginForm } from "@/components/login-form";

const DEMO = [
  { role: "userRole.ADMIN", email: "admin@havewa.app", pw: "admin" },
  { role: "userRole.MIETER", email: "mieter@havewa.app", pw: "mieter" },
  { role: "userRole.EIGENTUEMER", email: "eigentuemer@havewa.app", pw: "eigentuemer" },
];

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/");
  const t = await getTranslations();

  const points = [t("login.point1"), t("login.point2"), t("login.point3")];

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Brand-Panel (Desktop) */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(60% 55% at 85% 0%, rgba(255,255,255,.25) 0%, transparent 60%), radial-gradient(45% 40% at 0% 100%, rgba(255,255,255,.15) 0%, transparent 55%)",
          }}
        />
        <div className="relative flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.png" alt="HaVeWa" className="size-10 rounded-xl" />
          <div className="leading-tight">
            <div className="text-lg font-semibold">{t("app.name")}</div>
            <div className="text-xs opacity-80">{t("app.tagline")}</div>
          </div>
        </div>

        <div className="relative space-y-5">
          <h2 className="max-w-sm text-3xl font-semibold tracking-tight">{t("login.tagline")}</h2>
          <ul className="space-y-3 text-sm">
            {points.map((p, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary-foreground/15">
                  <Check className="size-3.5" />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative text-xs opacity-70">© 2026 HaVeWa · DSGVO- &amp; GoBD-orientiert</div>
      </div>

      {/* Formularseite */}
      <div className="flex items-center justify-center bg-muted/30 p-6">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2 text-center">
            {/* Logo (mobil) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.png" alt="HaVeWa" className="mx-auto size-12 rounded-xl lg:hidden" />
            <h1 className="text-2xl font-semibold tracking-tight">{t("login.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("login.subtitle")}</p>
          </div>

          <LoginForm />

          {/* Demo-Zugänge */}
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-3 text-xs font-medium text-muted-foreground">{t("login.demoTitle")}</p>
            <div className="space-y-2">
              {DEMO.map((d) => (
                <div key={d.email} className="flex items-center justify-between gap-3 text-xs">
                  <span className="rounded bg-muted px-2 py-0.5 font-medium">{t(d.role)}</span>
                  <code className="text-muted-foreground">
                    {d.email} · {d.pw}
                  </code>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
