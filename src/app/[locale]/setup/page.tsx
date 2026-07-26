import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { needsSetup } from "@/lib/setup";
import { SetupWizard } from "@/components/setup-wizard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SetupPage() {
  if (!(await needsSetup())) redirect("/login");
  const t = await getTranslations();

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-lg">
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
