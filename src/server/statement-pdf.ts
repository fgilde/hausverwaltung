import "server-only";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { money } from "@/lib/format";
import { mergeLetterPdf } from "@/lib/pdf-merge";
import { statementRows, type StatementRow } from "@/lib/statement-rows";
import { openLetter, mm, type LetterInput } from "@/server/letter-pdf";
import { senderLines, tenantContact, letterRecipients } from "@/server/letters";
import { computeStatement } from "@/server/statements";

// Betriebskostenabrechnung als PDF (#94, #102): Einzelabrechnung je Mietverhältnis mit allen
// Rechenschritten im Briefformat, dazu eine Übersicht fürs ganze Objekt. Ersetzt die
// HTML-Druckansicht, die im Dunkelmodus schlecht lesbar war.

type Head = Omit<LetterInput, "body" | "subject">;
type Doc = ReturnType<typeof openLetter>["doc"];

const LEFT = 25;
const BOTTOM = 270; // mm, darunter neue Seite (Platz für die Seitenzahl)

/** Tabelle mit festen Spalten (mm); Zeilenhöhe = höchste Zelle, Umbruch auf neue Seite mit Kopf. */
function table(doc: Doc, cols: { w: number; align?: "left" | "right" }[], head: string[], rows: string[][], bold: (i: number) => boolean = () => false) {
  const draw = (cells: string[], font: "R" | "B", size: number) => {
    doc.font(font).fontSize(size);
    const heights = cells.map((c, i) => doc.heightOfString(c, { width: mm(cols[i].w - 2) }));
    const h = Math.max(...heights) + mm(1.5);
    if (doc.y + h > mm(BOTTOM)) {
      doc.addPage();
      doc.y = mm(20);
      if (cells !== head) draw(head, "B", 8);
      doc.font(font).fontSize(size);
    }
    const y = doc.y;
    let x = mm(LEFT);
    cells.forEach((c, i) => {
      doc.text(c, x, y, { width: mm(cols[i].w - 2), align: cols[i].align ?? "left" });
      x += mm(cols[i].w);
    });
    doc.y = y + h;
  };
  const rule = (weight: number) => {
    doc.moveTo(mm(LEFT), doc.y).lineTo(mm(LEFT + 165), doc.y).lineWidth(weight).stroke();
    doc.y += mm(1);
  };
  draw(head, "B", 8);
  rule(0.8);
  rows.forEach((r, i) => {
    draw(r, bold(i) ? "B" : "R", 8.5);
  });
  rule(0.8);
}

/** Summenblock rechtsbündig: Bezeichnung links, Betrag rechts. */
function sums(doc: Doc, lines: { label: string; value: string; bold?: boolean }[]) {
  for (const l of lines) {
    if (doc.y > mm(BOTTOM)) {
      doc.addPage();
      doc.y = mm(20);
    }
    const y = doc.y;
    doc.font(l.bold ? "B" : "R").fontSize(10);
    doc.text(l.label, mm(LEFT + 70), y, { width: mm(70) });
    doc.text(l.value, mm(LEFT + 140), y, { width: mm(25), align: "right" });
    doc.y = y + mm(5.5);
  }
}

export type StatementPdfInput = Head & {
  year: number;
  propertyLine: string;
  unitLabel: string;
  renterNames: string;
  /** Abrechnungszeitraum und Nutzungszeitraum, schon formatiert */
  periods: { billing: string; usage: string };
  rows: StatementRow[];
  allocated: number;
  prepayment: number;
  balance: number;
  notes: string[];
};

/** Einzelabrechnung eines Mietverhältnisses (#94). */
export function statementPdf(s: StatementPdfInput): Promise<Buffer> {
  const { doc, finish } = openLetter({ ...s, subject: `Betriebskostenabrechnung ${s.year}` });
  doc.font("R").fontSize(10).moveDown(1);
  const facts: [string, string][] = [
    ["Objekt", s.propertyLine],
    ["Einheit", s.unitLabel],
    ["Mieter", s.renterNames],
    ["Abrechnungszeitraum", s.periods.billing],
    ["Ihr Nutzungszeitraum", s.periods.usage],
  ];
  for (const [k, v] of facts) {
    const y = doc.y;
    doc.font("B").text(k, mm(LEFT), y, { width: mm(45) });
    doc.font("R").text(v || "–", mm(LEFT + 45), y, { width: mm(120) });
  }
  doc.moveDown(1);

  table(
    doc,
    [{ w: 48 }, { w: 22, align: "right" }, { w: 53 }, { w: 20, align: "right" }, { w: 22, align: "right" }],
    ["Kostenart", "Gesamtkosten", "Schlüssel / Ihr Anteil", "Zeitanteil", "Ihre Kosten"],
    s.rows.map((r) => [r.label, money(r.total), `${r.key}: ${r.basis}`, r.share, money(r.amount)]),
  );
  doc.moveDown(0.5);
  sums(doc, [
    { label: "Ihre Betriebskosten", value: money(s.allocated) },
    { label: "abzüglich Ihrer Vorauszahlungen", value: money(s.prepayment ? -s.prepayment : 0) },
    {
      label: s.balance >= 0 ? "Guthaben zu Ihren Gunsten" : "Nachzahlung",
      value: money(Math.abs(s.balance)),
      bold: true,
    },
  ]);

  if (s.notes.length) {
    doc.moveDown(1);
    doc.font("R").fontSize(8);
    for (const n of s.notes) doc.text(n, mm(LEFT), doc.y, { width: mm(165) }).moveDown(0.3);
  }
  return finish();
}

export type StatementOverviewInput = Head & {
  year: number;
  propertyLine: string;
  costs: { label: string; key: string; amount: number }[];
  units: { label: string; allocated: number; prepayment: number; balance: number }[];
  /** es gibt Pauschalmieten (#110), deren Anteil der Vermieter trägt */
  flatRate?: boolean;
  totalUmlage: number;
};

/** Übersicht fürs ganze Objekt: Kostenaufstellung und Ergebnis je Einheit/Mietverhältnis. */
export function statementOverviewPdf(s: StatementOverviewInput): Promise<Buffer> {
  const { doc, finish } = openLetter({ ...s, subject: `Betriebskostenabrechnung ${s.year} – Übersicht` });
  doc.font("R").fontSize(10).moveDown(1).text(s.propertyLine, mm(LEFT), doc.y, { width: mm(165) }).moveDown(1);
  doc.font("B").fontSize(10).text("Kosten", mm(LEFT), doc.y).moveDown(0.3);
  table(
    doc,
    [{ w: 95 }, { w: 45 }, { w: 25, align: "right" }],
    ["Kostenart", "Schlüssel", "Betrag"],
    [...s.costs.map((c) => [c.label, c.key, money(c.amount)]), ["Summe umlagefähig", "", money(s.totalUmlage)]],
    (i) => i === s.costs.length,
  );
  doc.moveDown(1);
  doc.font("B").fontSize(10).text("Ergebnis je Mietverhältnis", mm(LEFT), doc.y).moveDown(0.3);
  table(
    doc,
    [{ w: 80 }, { w: 28, align: "right" }, { w: 28, align: "right" }, { w: 29, align: "right" }],
    ["Einheit", "Kosten", "Vorauszahlung", "Saldo"],
    s.units.map((u) => [u.label, money(u.allocated), money(u.prepayment), `${money(Math.abs(u.balance))} ${u.balance >= 0 ? "Guthaben" : "Nachzahlung"}`]),
  );
  // Rest = Leerstand bzw. nicht vermietete Zeiten, trägt der Vermieter; so geht die Summe auf
  const tenants = s.units.reduce((a, u) => a + u.allocated, 0);
  const landlord = Math.round((s.totalUmlage - tenants) * 100) / 100;
  doc.moveDown(0.5);
  sums(doc, [
    { label: "Summe Mieter", value: money(tenants) },
    ...(Math.abs(landlord) >= 0.01
      ? [{ label: s.flatRate ? "Leerstand und Pauschalmieten (trägt der Vermieter)" : "Leerstand (trägt der Vermieter)", value: money(landlord) }]
      : []),
    { label: "Umlagefähige Kosten gesamt", value: money(s.totalUmlage), bold: true },
  ]);
  return finish();
}

/**
 * PDFs einer Abrechnung aus computeStatement: ohne `key` die Übersicht plus alle
 * Einzelabrechnungen in einer Datei (statt der Druckansicht, #102), mit `key` nur die
 * Einzelabrechnung dieses Mietverhältnisses (#94). null, wenn es Objekt/Zeile nicht gibt.
 */
export async function statementPdfFor(tenantId: string, propertyId: string, year: number, key?: string) {
  const st = await computeStatement(tenantId, propertyId, year);
  if (!st.property) return null;
  const units = st.units.filter((u) => u.leaseId && !u.flatRate && (!key || u.key === key));
  if (key && units.length === 0) return null;

  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, address: true, phone: true, smtpFrom: true, heatingConsumptionPct: true } });
  const sender = { name: t?.name ?? "", lines: [...senderLines(t?.address).lines, ...tenantContact(t)] };
  const place = senderLines(t?.address).city || st.property.city;
  const fmt = (d: Date) => d.toLocaleDateString("de-DE", { timeZone: "UTC" });
  const date = new Date().toLocaleDateString("de-DE");
  const costLabel = await getTranslations({ locale: "de", namespace: "costType" });
  const keyLabel = await getTranslations({ locale: "de", namespace: "allocationMethod" });
  const propertyLine = `${st.property.name}, ${st.property.street}, ${st.property.zip} ${st.property.city}`;
  const recipients = new Map(
    (await letterRecipients(tenantId, [...new Set(units.flatMap((u) => u.renterPersonIds))])).map((r) => [r.id, r.address]),
  );
  const heatingPct = t?.heatingConsumptionPct ?? 70;

  const single = (u: (typeof units)[number]) => {
    const rows = statementRows(u.items, st.costs, (k) => costLabel(k), u.timeShare);
    const first = recipients.get(u.renterPersonIds[0]) ?? [];
    const notes = [
      "Zeitanteil: Monate Ihres Nutzungszeitraums von 12 Monaten, bei Ein- oder Auszug im Laufe eines Monats Ihre Tage von den Tagen des Jahres; bei Verbrauchskosten Ihr Anteil am Verbrauch der Einheit. Kosten für Zeiten ohne Mietverhältnis (Leerstand) trägt der Vermieter.",
      ...(u.items.some((i) => i.part !== "full")
        ? [`Heiz- und Warmwasserkosten nach Heizkostenverordnung: Verbrauchskosten nach erfasstem Verbrauch (in der Regel ${heatingPct} %), Grundkosten nach Wohnfläche.`]
        : []),
      ...(u.items.some((i) => i.apportion === "persons")
        ? ["Personenjahre: Personenzahl × Anteil der Tage am Abrechnungszeitraum; Änderungen der Personenzahl und Mieterwechsel werden tagesgenau berücksichtigt."]
        : []),
      "Einwendungen gegen diese Abrechnung sind spätestens bis zum Ablauf des zwölften Monats nach Zugang mitzuteilen (§ 556 Abs. 3 BGB).",
    ];
    return statementPdf({
      sender,
      recipient: [u.renterNames.join(" und "), ...first.slice(1)],
      place,
      date,
      year,
      propertyLine,
      unitLabel: u.label,
      renterNames: u.renterNames.join(", "),
      periods: {
        billing: `01.01.${year} – 31.12.${year}`,
        usage: u.period ? `${fmt(u.period.from)} – ${fmt(u.period.to)}` : "",
      },
      rows,
      allocated: u.allocated,
      prepayment: u.prepayment,
      balance: u.balance,
      notes,
    });
  };

  if (key) return { name: `Betriebskostenabrechnung ${year} - ${units[0].label}`, pdf: await single(units[0]) };

  const overview = await statementOverviewPdf({
    sender,
    recipient: [],
    place,
    date,
    year,
    propertyLine,
    costs: st.costs
      .filter((c) => c.umlagefaehig)
      .map((c) => ({ label: `${costLabel(c.type)}${c.note ? ` (${c.note})` : ""}`, key: keyLabel(c.method), amount: c.amount })),
    units: st.units.filter((u) => u.leaseId && !u.flatRate).map((u) => ({ label: u.label, allocated: u.allocated, prepayment: u.prepayment, balance: u.balance })),
    flatRate: st.units.some((u) => u.flatRate),
    totalUmlage: st.totalUmlage,
  });
  const singles = await Promise.all(units.map(single));
  return { name: `Betriebskostenabrechnung ${year} - ${st.property.name}`, pdf: await mergeLetterPdf(overview, singles) };
}
