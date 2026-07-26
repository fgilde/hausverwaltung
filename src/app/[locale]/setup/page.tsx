import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
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

      <Card className="w-full max-w-xl border-white/10 bg-card/95 shadow-2xl backdrop-blur">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Building2 className="size-6" />
          </div>
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
