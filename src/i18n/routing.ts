import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["de", "en", "pt-BR"],
  defaultLocale: "de",
});

// Anzeigename je Sprache, in der jeweiligen Sprache selbst.
export const localeLabels: Record<(typeof routing.locales)[number], string> = {
  de: "Deutsch",
  en: "English",
  "pt-BR": "Português (Brasil)",
};
