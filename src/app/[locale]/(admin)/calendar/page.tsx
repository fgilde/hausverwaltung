import { getTranslations, getLocale } from "next-intl/server";
import { ChevronLeft, ChevronRight, Wrench, Gavel, CalendarDays } from "lucide-react";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { date } from "@/lib/format";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppointmentDialog } from "@/components/appointment-dialog";
import { DeleteButton } from "@/components/delete-button";
import { deleteAppointment } from "@/server/actions/appointments";

type CalEvent = { day: number; label: string; kind: "appointment" | "maintenance" | "meeting"; id?: string };

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const t = await getTranslations();
  const locale = await getLocale();
  const tenantId = user.tenantId;
  const now = new Date();

  const year = Number(sp.year) || now.getFullYear();
  const month = sp.month != null ? Number(sp.month) : now.getMonth(); // 0-basiert
  const first = new Date(Date.UTC(year, month, 1));
  const last = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59));
  const daysInMonth = last.getUTCDate();

  const [appointments, maintenance, meetings, properties] = await Promise.all([
    prisma.appointment.findMany({
      where: { tenantId, start: { gte: first, lte: last } },
      include: { property: { select: { name: true } } },
      orderBy: { start: "asc" },
    }),
    prisma.maintenanceContract.findMany({
      where: { tenantId, nextDue: { gte: first, lte: last } },
      include: { property: { select: { name: true } } },
    }),
    prisma.meeting.findMany({
      where: { tenantId, date: { gte: first, lte: last } },
      include: { property: { select: { name: true } } },
    }),
    prisma.property.findMany({ where: { tenantId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const propertyOpts = properties.map((p) => ({ value: p.id, label: p.name }));

  const events: CalEvent[] = [
    ...appointments.map((a) => ({
      day: new Date(a.start).getUTCDate(),
      label: `${a.title}${a.property ? " · " + a.property.name : ""}`,
      kind: "appointment" as const,
      id: a.id,
    })),
    ...maintenance.map((m) => ({
      day: new Date(m.nextDue).getUTCDate(),
      label: `${t("nav.tickets")}: ${m.title}`,
      kind: "maintenance" as const,
    })),
    ...meetings.map((m) => ({
      day: new Date(m.date).getUTCDate(),
      label: `${t("appointmentType.VERSAMMLUNG")}: ${m.title}`,
      kind: "meeting" as const,
    })),
  ];
  const byDay = new Map<number, CalEvent[]>();
  for (const e of events) byDay.set(e.day, [...(byDay.get(e.day) ?? []), e]);

  // Monatsraster, Woche beginnt Montag.
  const firstWeekday = (first.getUTCDay() + 6) % 7; // 0 = Montag
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const prev = month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 };
  const next = month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 };
  const monthName = new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month, 1)));
  const weekdays =
    locale === "de"
      ? ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]
      : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const kindDot = (k: CalEvent["kind"]) =>
    k === "maintenance" ? "bg-amber-500" : k === "meeting" ? "bg-violet-500" : "bg-primary";

  const isToday = (d: number) =>
    now.getUTCFullYear() === year && now.getUTCMonth() === month && now.getUTCDate() === d;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("calendar.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("calendar.subtitle")}</p>
        </div>
        <AppointmentDialog properties={propertyOpts} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base capitalize">{monthName}</CardTitle>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" render={<Link href={`/calendar?year=${prev.year}&month=${prev.month}`} />}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" size="sm" render={<Link href="/calendar" />}>
              {t("calendar.today")}
            </Button>
            <Button variant="outline" size="icon" render={<Link href={`/calendar?year=${next.year}&month=${next.month}`} />}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border text-sm">
            {weekdays.map((w) => (
              <div key={w} className="bg-muted px-2 py-1.5 text-center text-xs font-medium text-muted-foreground">
                {w}
              </div>
            ))}
            {cells.map((d, i) => (
              <div key={i} className="min-h-24 bg-card p-1.5 align-top">
                {d && (
                  <>
                    <div className={`mb-1 text-xs ${isToday(d) ? "font-bold text-primary" : "text-muted-foreground"}`}>
                      {isToday(d) ? (
                        <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          {d}
                        </span>
                      ) : (
                        d
                      )}
                    </div>
                    <div className="space-y-0.5">
                      {(byDay.get(d) ?? []).slice(0, 3).map((e, j) => (
                        <div key={j} className="flex items-center gap-1 truncate text-[11px]" title={e.label}>
                          <span className={`size-1.5 shrink-0 rounded-full ${kindDot(e.kind)}`} />
                          <span className="truncate">{e.label}</span>
                        </div>
                      ))}
                      {(byDay.get(d)?.length ?? 0) > 3 && (
                        <div className="text-[10px] text-muted-foreground">+{(byDay.get(d)?.length ?? 0) - 3}</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Kommende Termine (Liste) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("calendar.upcoming")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {appointments.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("calendar.empty")}</p>
          ) : (
            appointments.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                <div className="flex items-center gap-2 text-sm">
                  <CalendarDays className="size-4 text-muted-foreground" />
                  <div>
                    <span className="font-medium">{a.title}</span>
                    <span className="ml-2">
                      <Badge variant="outline">{t(`appointmentType.${a.type}`)}</Badge>
                    </span>
                    <div className="text-xs text-muted-foreground">
                      {date(a.start, locale)}
                      {a.property ? ` · ${a.property.name}` : ""}
                      {a.location ? ` · ${a.location}` : ""}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <AppointmentDialog
                    properties={propertyOpts}
                    appointment={{
                      id: a.id,
                      title: a.title,
                      type: a.type,
                      start: a.start.toISOString(),
                      end: a.end ? a.end.toISOString() : null,
                      location: a.location,
                      propertyId: a.propertyId,
                      note: a.note,
                    }}
                  />
                  <DeleteButton action={deleteAppointment} id={a.id} />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-primary" /> {t("calendar.legendAppointment")}</span>
        <span className="flex items-center gap-1"><Wrench className="size-3" /> <span className="size-2 rounded-full bg-amber-500" /> {t("calendar.legendMaintenance")}</span>
        <span className="flex items-center gap-1"><Gavel className="size-3" /> <span className="size-2 rounded-full bg-violet-500" /> {t("calendar.legendMeeting")}</span>
      </div>
    </div>
  );
}
