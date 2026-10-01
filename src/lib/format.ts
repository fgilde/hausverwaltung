// UI-Sprache → BCP-47-Locale für Intl. "de"/"en" sind historisch kurz,
// alle weiteren Sprachen (z. B. "pt-BR") sind bereits vollständige Tags.
export function intlLocale(locale: string): string {
  return locale === "de" ? "de-DE" : locale === "en" ? "en-US" : locale;
}

export function money(value: number | string, locale = "de") {
  const n = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

// Dezimalzahl lokalisiert, bis 4 Nachkommastellen (z. B. MEA 53,9, #40).
export function decimal(value: number | null | undefined, locale = "de") {
  if (value == null) return "—";
  return new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 4 }).format(value);
}

// Datumsformat. `fmt` akzeptiert die UI-Sprache ("de"/"en"/"pt-BR"), eine
// BCP-47-Locale ("de-DE", "en-GB", "en-US") oder "iso" (YYYY-MM-DD). Das erlaubt
// ein vom UI unabhängiges Datumsformat (Mandanten-Einstellung, siehe getDateLocale).
export function date(value: Date | string | null | undefined, fmt = "de") {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (fmt === "iso") return d.toISOString().slice(0, 10);
  const locale = intlLocale(fmt);
  return new Intl.DateTimeFormat(locale).format(d);
}

// Datum + Uhrzeit (z. B. E-Mail-Verlauf). Server läuft in UTC, daher feste
// Zeitzone. ponytail: Europe/Berlin fest, Mandanten-Zeitzone wenn gebraucht.
export function dateTime(value: Date | string | null | undefined, fmt = "de") {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  const tz = "Europe/Berlin";
  if (fmt === "iso") {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
        .formatToParts(d).map((x) => [x.type, x.value]),
    );
    return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
  }
  const locale = intlLocale(fmt);
  return new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short", timeZone: tz }).format(d);
}
