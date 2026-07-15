import { Plus, Pencil } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { CrudDialog } from "@/components/crud-dialog";
import { TextField, SelectField, TextAreaField } from "@/components/form-fields";
import {
  createMeeting,
  updateMeeting,
  addAgenda,
  createResolution,
} from "@/server/actions/meetings";

type Opt = { value: string; label: string };
const iso = (d?: Date | null) => (d ? d.toISOString().slice(0, 10) : undefined);
const today = () => new Date().toISOString().slice(0, 10);

async function opts(ns: string, keys: string[]): Promise<Opt[]> {
  const t = await getTranslations(ns);
  return keys.map((k) => ({ value: k, label: t(k) }));
}

type MeetingData = {
  id: string;
  title: string;
  date: Date;
  location: string | null;
  status: string;
  protocol: string | null;
};

export async function MeetingDialog({
  properties,
  meeting,
}: {
  properties?: Opt[];
  meeting?: MeetingData;
}) {
  const t = await getTranslations();
  const edit = !!meeting;
  const statusOpts = await opts("meetingStatus", ["GEPLANT", "DURCHGEFUEHRT"]);
  return (
    <CrudDialog
      trigger={
        edit ? (
          <Button variant="ghost" size="icon" aria-label={t("common.edit")}>
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="size-4" />
            {t("meetings.new")}
          </Button>
        )
      }
      title={edit ? t("meetings.edit") : t("meetings.new")}
      action={edit ? updateMeeting : createMeeting}
      submitLabel={edit ? t("common.save") : t("common.create")}
    >
      {edit ? (
        <input type="hidden" name="id" value={meeting!.id} />
      ) : (
        <SelectField name="propertyId" label={t("meetings.property")} options={properties ?? []} />
      )}
      <TextField name="title" label={t("fields.name")} defaultValue={meeting?.title} />
      <div className="grid grid-cols-2 gap-4">
        <TextField name="date" label={t("fields.date")} type="date" defaultValue={iso(meeting?.date) ?? today()} />
        <SelectField name="status" label={t("leases.status")} defaultValue={meeting?.status ?? "GEPLANT"} options={statusOpts} />
      </div>
      <TextField name="location" label={t("meetings.location")} required={false} defaultValue={meeting?.location ?? undefined} />
      {edit && (
        <TextAreaField name="protocol" label={t("meetings.protocol")} defaultValue={meeting?.protocol ?? undefined} rows={5} />
      )}
    </CrudDialog>
  );
}

export async function AgendaDialog({ meetingId }: { meetingId: string }) {
  const t = await getTranslations();
  return (
    <CrudDialog
      trigger={
        <Button size="sm" variant="outline">
          <Plus className="size-4" />
          {t("meetings.addAgendaItem")}
        </Button>
      }
      title={t("meetings.addAgendaItem")}
      action={addAgenda}
      submitLabel={t("common.create")}
    >
      <input type="hidden" name="meetingId" value={meetingId} />
      <TextField name="title" label={t("fields.name")} />
      <TextAreaField name="description" label={t("rentComponent.note")} />
    </CrudDialog>
  );
}

export async function ResolutionDialog({
  propertyId,
  meetingId,
}: {
  propertyId: string;
  meetingId?: string;
}) {
  const t = await getTranslations();
  const resultOpts = await opts("resolutionResult", ["ANGENOMMEN", "ABGELEHNT", "VERTAGT"]);
  return (
    <CrudDialog
      trigger={
        <Button size="sm" variant="outline">
          <Plus className="size-4" />
          {t("meetings.addResolution")}
        </Button>
      }
      title={t("meetings.addResolution")}
      action={createResolution}
      submitLabel={t("common.create")}
    >
      <input type="hidden" name="propertyId" value={propertyId} />
      {meetingId && <input type="hidden" name="meetingId" value={meetingId} />}
      <TextField name="title" label={t("fields.name")} />
      <TextAreaField name="text" label={t("meetings.resolutionText")} required rows={4} />
      <div className="grid grid-cols-2 gap-4">
        <TextField name="date" label={t("fields.date")} type="date" defaultValue={today()} />
        <SelectField name="result" label={t("meetings.result")} defaultValue="ANGENOMMEN" options={resultOpts} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <TextField name="votesYes" label={t("meetings.yes")} type="number" defaultValue={0} />
        <TextField name="votesNo" label={t("meetings.no")} type="number" defaultValue={0} />
        <TextField name="votesAbstain" label={t("meetings.abstain")} type="number" defaultValue={0} />
      </div>
    </CrudDialog>
  );
}
