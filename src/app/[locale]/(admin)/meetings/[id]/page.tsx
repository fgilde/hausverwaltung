import { ArrowLeft, X } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { date } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MeetingDialog, AgendaDialog, ResolutionDialog } from "@/components/meeting-dialogs";
import { DeleteButton } from "@/components/delete-button";
import { deleteMeeting, deleteAgenda, deleteResolution } from "@/server/actions/meetings";

export default async function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const t = await getTranslations();
  const locale = await getLocale();

  const meeting = await prisma.meeting.findFirst({
    where: { id, tenantId: user.tenantId },
    include: {
      property: true,
      agendaItems: { orderBy: { position: "asc" } },
      resolutions: { orderBy: { number: "asc" } },
    },
  });
  if (!meeting) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" render={<Link href="/meetings" />}>
            <ArrowLeft className="size-4" />
            {t("meetings.title")}
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">{meeting.title}</h1>
          <p className="text-sm text-muted-foreground">
            {meeting.property.name} · {date(meeting.date, locale)}
            {meeting.location ? ` · ${meeting.location}` : ""}
          </p>
          <Badge variant={meeting.status === "DURCHGEFUEHRT" ? "secondary" : "outline"}>
            {t(`meetingStatus.${meeting.status}`)}
          </Badge>
        </div>
        <div className="flex gap-1">
          <MeetingDialog
            meeting={{
              id: meeting.id,
              title: meeting.title,
              date: meeting.date,
              location: meeting.location,
              status: meeting.status,
              protocol: meeting.protocol,
            }}
          />
          <DeleteButton action={deleteMeeting} id={meeting.id} />
        </div>
      </div>

      {/* Tagesordnung */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{t("meetings.agenda")}</CardTitle>
          <AgendaDialog meetingId={meeting.id} />
        </CardHeader>
        <CardContent className="space-y-2">
          {meeting.agendaItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("meetings.noAgenda")}</p>
          ) : (
            meeting.agendaItems.map((a) => (
              <div key={a.id} className="flex items-start justify-between rounded-md border px-3 py-2">
                <div className="text-sm">
                  <span className="font-medium">TOP {a.position}: {a.title}</span>
                  {a.description ? (
                    <p className="text-muted-foreground">{a.description}</p>
                  ) : null}
                </div>
                <form action={deleteAgenda}>
                  <input type="hidden" name="id" value={a.id} />
                  <Button type="submit" variant="ghost" size="icon" aria-label={t("common.delete")}>
                    <X className="size-4" />
                  </Button>
                </form>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Beschlüsse */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{t("meetings.resolutions")}</CardTitle>
          <ResolutionDialog propertyId={meeting.propertyId} meetingId={meeting.id} />
        </CardHeader>
        <CardContent className="space-y-3">
          {meeting.resolutions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("meetings.noResolutions")}</p>
          ) : (
            meeting.resolutions.map((r) => (
              <div key={r.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-medium">
                      #{r.number} · {r.title}
                    </span>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{r.text}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={r.result === "ANGENOMMEN" ? "secondary" : r.result === "ABGELEHNT" ? "destructive" : "outline"}>
                      {t(`resolutionResult.${r.result}`)}
                    </Badge>
                    <DeleteButton action={deleteResolution} id={r.id} />
                  </div>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {t("meetings.votes")}: {t("meetings.yes")} {r.votesYes} · {t("meetings.no")} {r.votesNo} · {t("meetings.abstain")} {r.votesAbstain}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Protokoll */}
      {meeting.protocol ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("meetings.protocol")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{meeting.protocol}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
