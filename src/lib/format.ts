export function money(value: number | string, locale = "de") {
  const n = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-US", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

// Datumsformat. `fmt` akzeptiert die UI-Sprache ("de"/"en", Altverhalten), eine
// BCP-47-Locale ("de-DE", "en-GB", "en-US") oder "iso" (YYYY-MM-DD). Das erlaubt
// ein vom UI unabhängiges Datumsformat (Mandanten-Einstellung, siehe getDateLocale).
export function date(value: Date | string | null | undefined, fmt = "de") {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (fmt === "iso") return d.toISOString().slice(0, 10);
  const locale = fmt === "de" ? "de-DE" : fmt === "en" ? "en-US" : fmt;
  return new Intl.DateTimeFormat(locale).format(d);
}
