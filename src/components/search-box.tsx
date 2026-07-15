"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function SearchBox() {
  const t = useTranslations("search");
  const router = useRouter();
  const [q, setQ] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const query = q.trim();
        if (query) router.push(`/search?q=${encodeURIComponent(query)}`);
      }}
      className="relative hidden sm:block"
    >
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("placeholder")}
        aria-label={t("placeholder")}
        className={cn(
          "h-8 w-48 rounded-lg border border-input bg-transparent pl-8 pr-3 text-sm shadow-xs md:w-64",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none",
          "dark:bg-input/30",
        )}
      />
    </form>
  );
}
