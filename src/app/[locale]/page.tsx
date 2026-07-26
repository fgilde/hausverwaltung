import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Landing route for "/de" (and "/en"). Outside the (admin) group so it isn't
// subject to that group's requireUser() guard.
// - Authenticated  -> app dashboard.
// - Unauthenticated + Demo-Daten geseedet -> öffentliche Marketing-Seite.
// - Unauthenticated ohne Demo (echte Installation) -> Login (bzw. Setup-Wizard).
export default async function LocaleRootPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const demo = await prisma.tenant.findFirst({ where: { isDemo: true }, select: { id: true } });
  redirect(demo ? "/marketing/index.html" : "/login");
}
