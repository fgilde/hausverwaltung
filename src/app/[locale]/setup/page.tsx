import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { needsSetup } from "@/lib/setup";
import { listBackgroundVideos } from "@/lib/videos";
import { BackgroundVideo } from "@/components/background-video";
import { SetupWizard } from "@/components/setup-wizard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SetupPage() {
  if (!(await needsSetup())) redirect("/login");
  const t = await getTranslations();
  const videos = await listBackgroundVideos();

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden p-4">
      {videos.length > 0 ? (
        <BackgroundVideo sources={videos} className="absolute inset-0 -z-10" />
      ) : (
        <div className="absolute inset-0 -z-10 bg-primary" />
      )}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-black/70 via-black/50 to-primary/40" />

      {/* Produkt-Icon unten rechts im Video-Bereich */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/marketing/icon.png"
        alt="HaVeWa"
        className="pointer-events-none absolute bottom-6 right-6 h-16 w-auto object-contain opacity-90 drop-shadow-lg"
      />

      <Card className="w-full max-w-xl border-white/10 bg-card/95 shadow-2xl backdrop-blur">
        <CardHeader className="items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="HaVeWa" className="mx-auto mb-2 h-48 w-auto object-contain drop-shadow" />
          <CardTitle className="text-xl">{t("setup.title")}</CardTitle>
          <CardDescription>{t("setup.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <SetupWizard />
        </CardContent>
      </Card>
    </div>
  );
}
