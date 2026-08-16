"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Loader2, Check, Eye, EyeOff } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({
  initialEmail = "",
  tenantName,
}: {
  initialEmail?: string;
  tenantName?: string;
}) {
  const t = useTranslations("login");
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);
  const [showPw, setShowPw] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(false);
    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.error) {
      setError(true);
      setLoading(false);
    } else {
      setOk(true);
      setTimeout(() => router.replace("/"), 950);
    }
  }

  return (
    <>
      <form
        onSubmit={onSubmit}
        className={`space-y-4 transition-all duration-500 ${ok ? "-translate-x-6 opacity-0" : ""}`}
      >
        <div className="space-y-2">
          <Label htmlFor="email">{t("email")}</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">{t("password")}</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground"
              aria-label={showPw ? t("hidePassword") : t("showPassword")}
              title={showPw ? t("hidePassword") : t("showPassword")}
            >
              {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{t("error")}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="size-4 animate-spin" />}
          {t("submit")}
        </Button>
      </form>

      {/* Erfolgs-Animation */}
      {ok && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/85 backdrop-blur-md animate-in fade-in duration-300">
          <div className="flex flex-col items-center gap-4 duration-700 animate-in zoom-in-90 slide-in-from-bottom-4">
            <div className="grid size-16 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
              <Check className="size-8 animate-in zoom-in duration-500" />
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold">
                {t("welcome")}
                {tenantName ? `, ${tenantName}` : ""}
              </div>
              <div className="mt-1 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {t("loadingApp")}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
