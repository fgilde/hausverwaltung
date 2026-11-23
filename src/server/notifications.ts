import { getTenantCurrency } from "@/lib/tenant-currency";
import "server-only";
import { prisma } from "@/lib/prisma";
import { date, dateTime, money } from "@/lib/format";
import { notifyByEmail, notifyManagers } from "@/lib/notify";
import { DAY_MS, HOUR_MS, digest, leadRange, type NotifyKind } from "@/lib/notify-kinds";

// E-Mail-Benachrichtigungen (#77): je Lauf das Zeitfenster (cursor, jetzt] prüfen und je
// aktivierter Art eine Sammelmail an die Verwalter senden (plus Glocke in der App).
// Ein Cursor statt Merker je Datensatz: fällt ein Lauf aus, holt der nächste nach.

// Briefstatus je eigene Art schaltbar (#80)
const LETTER_KIND = { VERSENDET: "LETTER_SENT", ZUGESTELLT: "LETTER_DELIVERED", FEHLER: "LETTER_FAILED" } as const;
const LETTER_LABEL: Record<string, string> = { VERSENDET: "versendet", ZUGESTELLT: "zugestellt", FEHLER: "fehlgeschlagen" };
// ponytail: Rückstände nur aus den letzten 30 Tagen, sonst schickt das Einschalten den ganzen Altbestand
const OVERDUE_LOOKBACK_MS = 30 * DAY_MS;

export async function runNotifications(tenantId: string, kinds: NotifyKind[], prev: Date, now: Date) {
  const currency = await getTenantCurrency(tenantId);
  const on = (k: NotifyKind) => kinds.includes(k);
  const range = { gt: prev, lte: now };

  if (on("RENT_OVERDUE")) {
    // überfällig ab dem Tag nach der Fälligkeit, wenn noch etwas offen ist
    const charges = await prisma.charge.findMany({
      where: { tenantId, dueDate: { gt: new Date(prev.getTime() - DAY_MS), lte: new Date(now.getTime() - DAY_MS), gte: new Date(now.getTime() - OVERDUE_LOOKBACK_MS) } },
      include: {
        payments: { select: { amount: true } },
        lease: { include: { unit: { select: { label: true } }, renters: { take: 1, include: { person: { select: { firstName: true, lastName: true } } } } } },
        areaAllocation: { select: { label: true } },
      },
      orderBy: { dueDate: "asc" },
    });
    const open = charges
      .map((c) => ({ c, open: Number(c.amount) - c.payments.reduce((a, p) => a + Number(p.amount), 0) }))
      .filter((x) => x.open > 0.005);
    if (open.length) {
      const items = open.map(({ c, open }) => {
        const who = c.lease?.renters[0]?.person;
        const name = who ? `${who.firstName} ${who.lastName}` : (c.areaAllocation?.label ?? "");
        return `${[name, c.lease?.unit.label].filter(Boolean).join(" · ")}: ${money(open, "de", currency)} offen (fällig ${date(c.dueDate)})`;
      });
      await notifyManagers(tenantId, {
        title: open.length === 1 ? "Mietzahlung überfällig" : `${open.length} Mietzahlungen überfällig`,
        body: digest("Folgende Zahlungen sind nach Fälligkeit nicht (vollständig) eingegangen:", items),
        link: "/finances",
      }, "RENT_OVERDUE");
    }
  }

  // Ein- und Ausgänge getrennt schaltbar (#80), je Richtung eine Sammelmail
  for (const [kind, direction, one, many] of [["PAYMENTS_IN", "EINGANG", "Zahlungseingang", "Zahlungseingänge"], ["PAYMENTS_OUT", "AUSGANG", "Zahlungsausgang", "Zahlungsausgänge"]] as const) {
    if (!on(kind)) continue;
    const payments = await prisma.payment.findMany({ where: { tenantId, direction, createdAt: range }, orderBy: { date: "asc" } });
    if (!payments.length) continue;
    const sum = payments.reduce((a, p) => a + Number(p.amount), 0);
    const items = payments.map(
      (p) => `${date(p.date)} ${money(Number(p.amount), "de", currency)}${p.counterparty ? ` · ${p.counterparty}` : ""}${p.reference ? ` · ${p.reference}` : ""}`,
    );
    await notifyManagers(tenantId, {
      title: payments.length === 1 ? `Neuer ${one}` : `${payments.length} neue ${many}`,
      body: digest(`Summe ${money(sum, "de", currency)}`, items),
      link: "/finances",
    }, kind);
  }

  for (const [status, kind] of Object.entries(LETTER_KIND)) {
    if (!on(kind)) continue;
    const events = await prisma.letterStatusEvent.findMany({
      where: { at: range, status: status as keyof typeof LETTER_KIND, letter: { tenantId } },
      include: { letter: { select: { subject: true, recipient: true } } },
      orderBy: { at: "asc" },
    });
    if (!events.length) continue;
    const items = events.map((e) => `${e.letter.subject} an ${e.letter.recipient.split("\n")[0]}${e.statusText ? ` (${e.statusText})` : ""}`);
    await notifyManagers(tenantId, {
      title: events.length === 1 ? `Brief ${LETTER_LABEL[status]}` : `${events.length} Briefe ${LETTER_LABEL[status]}`,
      body: digest(`Brief ${LETTER_LABEL[status]}:`, items),
      link: "/communication?box=letters",
    }, kind);
  }

  if (on("INBOUND_EMAIL")) {
    const mails = await prisma.inboundEmail.findMany({ where: { tenantId, createdAt: range }, orderBy: { receivedAt: "asc" } });
    if (mails.length) {
      const items = mails.map((m) => `${m.fromName || m.fromAddress}: ${m.subject ?? "(ohne Betreff)"}`);
      await notifyManagers(tenantId, {
        title: mails.length === 1 ? "Neue E-Mail eingegangen" : `${mails.length} neue E-Mails eingegangen`,
        body: digest("Im Posteingang:", items),
        link: "/communication?box=in",
      }, "INBOUND_EMAIL");
    }
  }

  for (const [kind, lead, label] of [["APPOINTMENT_DAY", DAY_MS, "morgen"], ["APPOINTMENT_HOUR", HOUR_MS, "in einer Stunde"]] as const) {
    if (!on(kind)) continue;
    const appts = await prisma.appointment.findMany({
      where: { tenantId, start: leadRange(lead, prev, now) },
      include: { persons: { select: { email: true } }, property: { select: { name: true } } },
      orderBy: { start: "asc" },
    });
    for (const a of appts) {
      const n = {
        title: `Termin ${label}: ${a.title}`,
        body: [`${dateTime(a.start)}${a.end ? ` – ${dateTime(a.end)}` : ""}`, a.location, a.property?.name, a.note].filter(Boolean).join("\n"),
        link: "/calendar",
      };
      await notifyManagers(tenantId, n, kind);
      // Teilnehmer (#74) optional mit erinnern
      if (on("APPOINTMENT_PERSONS")) {
        await notifyByEmail(tenantId, "APPOINTMENT_PERSONS", a.persons.map((p) => p.email ?? ""), { title: n.title, body: n.body });
      }
    }
  }
}

/** Alle Mandanten mit aktivierten Benachrichtigungen prüfen (Hintergrundjob). */
export async function runAllNotifications(now = new Date()) {
  const tenants = await prisma.tenant.findMany({ where: { NOT: { notifyEmail: { isEmpty: true } } }, select: { id: true, notifyEmail: true, notifyCursorAt: true } });
  for (const t of tenants) {
    // erster Lauf nach dem Einschalten: ab jetzt, kein Nachholen
    const prev = t.notifyCursorAt ?? now;
    await prisma.tenant.update({ where: { id: t.id }, data: { notifyCursorAt: now } });
    if (prev >= now) continue;
    try {
      await runNotifications(t.id, t.notifyEmail as NotifyKind[], prev, now);
    } catch (e) {
      console.warn(`[notify] Mandant ${t.id}:`, e instanceof Error ? e.message : e);
    }
  }
}
