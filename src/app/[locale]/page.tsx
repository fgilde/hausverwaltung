import { redirect } from "next/navigation";
import { auth } from "@/auth";

// Landing route for "/de" (and "/en"). Deliberately outside the (admin)
// group so it isn't subject to that group's requireUser() guard:
// unauthenticated visitors get the public marketing site instead of a
// forced login redirect. Authenticated visitors go straight to the app;
// (admin)/layout.tsx still enforces auth + role routing from there on.
export default async function LocaleRootPage() {
  const session = await auth();
  if (!session?.user) redirect("/marketing/index.html");
  redirect("/dashboard");
}
