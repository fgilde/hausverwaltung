import { getTranslations, getLocale } from "next-intl/server";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { date } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MeetingDialog } from "@/components/meeting-dialogs";

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const t = await getTranslations();
  const locale = await getLocale();
  const tenantId = user.tenantId;

  const wegProps = await prisma.property.findMany({
    where: { tenantId, management: "WEG" },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  const propertyId = sp.propertyId || wegProps[0]?.id;

  if (!propertyId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("meetings.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("meetings.subtitle")}</p>
        </div>
        <p className="text-sm text-muted-foreground">{t("weg.noWeg")}</p>
      </div>
    );
  }

  const [meetings, resolutions] = await Promise.all([
    prisma.meeting.findMany({
      where: { tenantId, propertyId },
      include: { _count: { select: { agendaItems: true, resolutions: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.resolution.findMany({ where: { tenantId, propertyId }, orderBy: { number: "asc" } }),
  ]);

  const propertyOpts = wegProps.map((p) => ({ value: p.id, label: p.name }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("meetings.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("meetings.subtitle")}</p>
        </div>
        <MeetingDialog properties={propertyOpts} />
      </div>

      <form className="flex items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">{t("meetings.property")}</label>
          <select name="propertyId" defaultValue={propertyId} className="flex h-9 rounded-lg border border-input bg-transparent px-3 text-sm dark:bg-input/30">
            {wegProps.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </select>
        </div>
        <Button type="submit" size="sm" variant="outline">{t("common.search")}</Button>
      </form>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("meetings.title")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {meetings.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">{t("meetings.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("fields.name")}</TableHead>
                  <TableHead>{t("fields.date")}</TableHead>
                  <TableHead>{t("leases.status")}</TableHead>
                  <TableHead className="text-right">{t("meetings.agenda")}</TableHead>
                  <TableHead className="text-right">{t("meetings.resolutions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {meetings.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">
                      <Link href={`/meetings/${m.id}`} className="hover:underline">
                        {m.title}
                      </Link>
                    </TableCell>
                    <TableCell>{date(m.date, locale)}</TableCell>
                    <TableCell>
                      <Badge variant={m.status === "DURCHGEFUEHRT" ? "secondary" : "outline"}>
                        {t(`meetingStatus.${m.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{m._count.agendaItems}</TableCell>
                    <TableCell className="text-right">{m._count.resolutions}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Beschlusssammlung */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("meetings.collection")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {resolutions.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">{t("meetings.noResolutions")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">{t("meetings.number")}</TableHead>
                  <TableHead>{t("fields.name")}</TableHead>
                  <TableHead>{t("fields.date")}</TableHead>
                  <TableHead>{t("meetings.result")}</TableHead>
                  <TableHead className="text-right">{t("meetings.votes")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resolutions.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono">{r.number}</TableCell>
                    <TableCell className="font-medium">{r.title}</TableCell>
                    <TableCell>{date(r.date, locale)}</TableCell>
                    <TableCell>
                      <Badge variant={r.result === "ANGENOMMEN" ? "secondary" : r.result === "ABGELEHNT" ? "destructive" : "outline"}>
                        {t(`resolutionResult.${r.result}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {r.votesYes}/{r.votesNo}/{r.votesAbstain}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
