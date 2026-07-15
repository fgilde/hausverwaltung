export function money(value: number | string, locale = "de") {
  const n = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-US", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

export function date(value: Date | string | null | undefined, locale = "de") {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-US").format(d);
}
