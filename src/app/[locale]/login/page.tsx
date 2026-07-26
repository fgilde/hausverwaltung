import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Check, Building2, ShieldCheck } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { needsSetup } from "@/lib/setup";
import { listBackgroundVideos } from "@/lib/videos";
import { BackgroundVideo } from "@/components/background-video";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage() {
  if (await needsSetup()) redirect("/setup");
  const session = await auth();
  if (session?.user) redirect("/");
  const t = await getTranslations();

  const tenant = await prisma.tenant.findFirst({
    orderBy: { createdAt: "asc" },
    select: { name: true, isDemo: true, logoKey: true },
  });
  const tenantName = tenant?.name ?? t("app.name");
  const isDemo = tenant?.isDemo ?? false;
  // Eigenes Admin-Logo, sonst Produkt-Logo
  const logoUrl = tenant?.logoKey ? "/api/logo" : "/logo.png";
  const videos = await listBackgroundVideos();

  const points = [t("login.point1"), t("login.point2"), t("login.point3")];
  const demo = [
    { role: "userRole.ADMIN", email: "admin@havewa.app", pw: "admin" },
    { role: "userRole.MIETER", email: "mieter@havewa.app", pw: "mieter" },
    { role: "userRole.EIGENTUEMER", email: "eigentuemer@havewa.app", pw: "eigentuemer" },
  ];

  return (
    <div className="grid min-h-svh lg:grid-cols-[1.1fr_1fr]">
      {/* Brand-Panel (Desktop) */}
      <div className="relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex">
        {videos.length > 0 ? (
          <BackgroundVideo sources={videos} className="absolute inset-0 -z-10" />
        ) : (
          <div className="absolute inset-0 -z-10 bg-primary" />
        )}
        {/* Legibilitäts-Overlays */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/45 to-black/25" />
        <div className="absolute inset-0 -z-10 bg-primary/25 mix-blend-multiply" />

        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-white/15 backdrop-blur">
            <Building2 className="size-5" />
          </div>
          <div className="text-lg font-semibold tracking-tight">{tenantName}</div>
        </div>

        <div className="max-w-md space-y-6">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">{t("login.tagline")}</h2>
          <ul className="space-y-3 text-sm text-white/90">
            {points.map((p, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-white/20">
                  <Check className="size-3.5" />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-2 text-xs text-white/70">
          <ShieldCheck className="size-4" />
          © 2026 {t("app.name")} · DSGVO- &amp; GoBD-orientiert
        </div>
      </div>

      {/* Formularseite */}
      <div className="relative flex items-center justify-center overflow-hidden bg-muted/30 p-6">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(60% 50% at 100% 0%, color-mix(in oklch, var(--primary) 12%, transparent) 0%, transparent 60%)",
          }}
        />
        <div className="relative w-full max-w-sm space-y-8">
          <div className="space-y-3 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt={tenantName} className="mx-auto h-16 w-auto object-contain" />
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("login.welcomeTo")} {tenantName}
            </h1>
            <p className="text-sm text-muted-foreground">{t("login.subtitle")}</p>
          </div>

          <LoginForm initialEmail={isDemo ? "admin@havewa.app" : ""} tenantName={tenantName} />

          {isDemo && (
            <div className="rounded-xl border bg-card/60 p-4 backdrop-blur">
              <p className="mb-3 text-xs font-medium text-muted-foreground">{t("login.demoTitle")}</p>
              <div className="space-y-2">
                {demo.map((d) => (
                  <div key={d.email} className="flex items-center justify-between gap-3 text-xs">
                    <span className="rounded bg-muted px-2 py-0.5 font-medium">{t(d.role)}</span>
                    <code className="text-muted-foreground">
                      {d.email} · {d.pw}
                    </code>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
