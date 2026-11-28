import { getTranslations, getLocale } from "next-intl/server";
import { money } from "@/lib/format";
import type { AnlageV, AnlageVRow } from "@/server/tax";

// Anlage-V-Übersicht (#103) als Tabelle, für Seite und Druckansicht.

export async function anlageVLabel() {
  const t = await getTranslations();
  return (r: AnlageVRow, rate?: number) =>
    r.key === "cost" ? t(`costType.${r.label}`) : r.key === "afa" && rate != null ? `${t("tax.afa")} (${String(rate).replace(".", ",")} %)` : t(`tax.${r.key}`);
}

export async function AnlageVTable({ data, print = false }: { data: AnlageV; print?: boolean }) {
  const t = await getTranslations();
  const locale = await getLocale();
  const label = await anlageVLabel();
  const line = print ? "border-b border-neutral-300" : "border-b";
  const strong = print ? "border-t-2 border-black font-semibold" : "border-t-2 font-semibold";
  const section = (title: string, rows: AnlageVRow[], total: number, totalLabel: string) => (
    <>
      <tr>
        <td colSpan={2} className="pt-4 pb-1 font-semibold">{title}</td>
      </tr>
      {rows.map((r, i) => (
        <tr key={`${r.key}-${r.label ?? i}`} className={line}>
          <td className="py-1.5 pl-3">{label(r, data.afa?.rate)}</td>
          <td className="py-1.5 text-right tabular-nums">{money(r.amount, locale)}</td>
        </tr>
      ))}
      <tr className={strong}>
        <td className="py-1.5">{totalLabel}</td>
        <td className="py-1.5 text-right tabular-nums">{money(total, locale)}</td>
      </tr>
    </>
  );
  return (
    <table className="w-full border-collapse text-sm">
      <tbody>
        {section(t("tax.income"), data.income, data.incomeTotal, t("tax.incomeTotal"))}
        {section(t("tax.expenses"), data.expenses, data.expenseTotal, t("tax.expenseTotal"))}
        <tr className={`${strong} text-base`}>
          <td className="pt-4 pb-1.5">{t("tax.surplus")}</td>
          <td className="pt-4 pb-1.5 text-right tabular-nums">{money(data.surplus, locale)}</td>
        </tr>
      </tbody>
    </table>
  );
}

/** Hinweise unter der Tabelle (Zufluss, Kostenjahr, nicht zugeordnete Eingänge). */
export async function AnlageVNotes({ data, className }: { data: AnlageV; className?: string }) {
  const t = await getTranslations();
  const locale = await getLocale();
  return (
    <ul className={`list-disc space-y-1 pl-5 ${className ?? ""}`}>
      <li>{t("tax.noteIncome")}</li>
      <li>{t("tax.noteCosts")}</li>
      {data.afa ? (
        <li>{t("tax.noteAfaRest", { rest: money(data.afa.restAfter, locale) })}</li>
      ) : (
        <li>{t("tax.noteNoAfa")}</li>
      )}
      {data.unassignedReceipts > 0 && <li>{t("tax.noteUnassigned", { count: data.unassignedReceipts })}</li>}
      <li>{t("tax.noteDisclaimer")}</li>
    </ul>
  );
}
