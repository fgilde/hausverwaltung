"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FileText, Plus, Send, TriangleAlert, RefreshCw, Eye } from "lucide-react";
import { createLetter, sendLetter, refreshLetters } from "@/server/actions/letters";
import type { ActionState } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type ProviderInfo = { id: "PINGEN" | "EPOST"; test: boolean };
type Recipient = { id: string; label: string; address: string[] };
type Tpl = { id: string; name: string; subject: string | null; body: string };

const fieldCls = cn(
  "flex w-full rounded-lg border border-input bg-transparent px-3 text-sm shadow-xs",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none dark:bg-input/30",
);

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/** Geworfene Fehler der Server-Action als Meldung anzeigen statt den Dialog abzubrechen (wie CrudDialog). */
function safe(action: Action, fallback: string): Action {
  return async (prev, fd) => {
    try {
      return await action(prev, fd);
    } catch (e) {
      if (e && typeof e === "object" && "digest" in e && String((e as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")) throw e;
      return { error: e instanceof Error ? e.message : fallback };
    }
  };
}

/** Erfolg genau einmal je Absenden behandeln (wie CrudDialog). */
function useDone(state: ActionState, onOk: () => void) {
  const handled = useRef<ActionState | null>(null);
  useEffect(() => {
    if (state.ok && handled.current !== state) {
      handled.current = state;
      onOk();
    }
  }, [state, onOk]);
}

/** Versandweg und -optionen; ohne eingerichteten Anbieter nur „PDF erstellen“. */
function ShippingFields({ providers, allowNone, onProvider }: { providers: ProviderInfo[]; allowNone: boolean; onProvider: (p: string) => void }) {
  const t = useTranslations("letters");
  const [provider, setProvider] = useState(allowNone ? "" : (providers[0]?.id ?? ""));
  useEffect(() => onProvider(provider), [provider, onProvider]);
  if (providers.length === 0) return <p className="text-xs text-muted-foreground">{t("noProvider")}</p>;
  const current = providers.find((p) => p.id === provider);
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="lProvider">{t("provider")}</Label>
          <select id="lProvider" name="provider" value={provider} onChange={(e) => setProvider(e.target.value)} className={cn(fieldCls, "h-9")}>
            {allowNone && <option value="">{t("providerNone")}</option>}
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {t(`provider_${p.id}`)}
                {p.test ? ` (${t("testMode")})` : ""}
              </option>
            ))}
          </select>
        </div>
        {provider && (
          <div className="space-y-1.5">
            <Label htmlFor="lMode">{t("mode")}</Label>
            <select id="lMode" name="mode" defaultValue="standard" className={cn(fieldCls, "h-9")}>
              <option value="standard">{t("modeStandard")}</option>
              {provider === "PINGEN" && <option value="fast">{t("modeFast")}</option>}
              <option value="registered">{t("modeRegistered")}</option>
            </select>
          </div>
        )}
      </div>
      {provider && (
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="color" className="size-4" /> {t("color")}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="duplex" className="size-4" /> {t("duplex")}
          </label>
        </div>
      )}
      {current?.test && <p className="text-xs text-amber-600 dark:text-amber-400">{t("testHint")}</p>}
    </div>
  );
}

export function LetterDialog({
  recipients,
  templates,
  providers,
  place,
  today,
}: {
  recipients: Recipient[];
  templates: Tpl[];
  providers: ProviderInfo[];
  place: string;
  today: string;
}) {
  const t = useTranslations("letters");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [personId, setPersonId] = useState("");
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [provider, setProvider] = useState("");
  const [state, action, pending] = useActionState<ActionState, FormData>(safe(createLetter, tc("actionFailed")), {});
  useDone(state, () => {
    setOpen(false);
    toast.success(t(provider ? "sent" : "created"));
    router.refresh();
  });

  function pickPerson(id: string) {
    setPersonId(id);
    const r = recipients.find((x) => x.id === id);
    if (r) setRecipient(r.address.join("\n"));
  }
  function pickTemplate(id: string) {
    const tpl = templates.find((x) => x.id === id);
    if (!tpl) return;
    if (tpl.subject) setSubject(tpl.subject);
    setBody(tpl.body);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Plus className="size-4" /> {t("new")}
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("new")}</DialogTitle>
        </DialogHeader>
        {/* Standard-Absenden = Vorschau (PDF in neuem Tab); Erstellen/Senden über die Server-Action */}
        <form method="post" action="/api/letters/preview" target="_blank" className="space-y-4">
          <input type="hidden" name="personId" value={personId} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="lPerson">{t("recipientPick")}</Label>
              <select id="lPerson" value={personId} onChange={(e) => pickPerson(e.target.value)} className={cn(fieldCls, "h-9")}>
                <option value="">—</option>
                {recipients.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </div>
            {templates.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="lTpl">{t("template")}</Label>
                <select id="lTpl" defaultValue="" onChange={(e) => pickTemplate(e.target.value)} className={cn(fieldCls, "h-9")}>
                  <option value="">—</option>
                  {templates.map((tp) => (
                    <option key={tp.id} value={tp.id}>{tp.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lRecipient">{t("recipient")}</Label>
            <textarea
              id="lRecipient"
              name="recipient"
              rows={4}
              required
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder={t("recipientPlaceholder")}
              className={cn(fieldCls, "py-2 font-mono")}
            />
            <p className="text-xs text-muted-foreground">{t("recipientHint")}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lPlace">{t("place")}</Label>
              <Input id="lPlace" name="place" defaultValue={place} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lDate">{t("date")}</Label>
              <Input id="lDate" name="date" defaultValue={today} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lSubject">{t("subject")}</Label>
            <Input id="lSubject" name="subject" required value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lBody">{t("body")}</Label>
            <textarea
              id="lBody"
              name="body"
              rows={12}
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t("bodyPlaceholder")}
              className={cn(fieldCls, "py-2")}
            />
          </div>
          <ShippingFields providers={providers} allowNone onProvider={setProvider} />
          {state.error && (
            <p className="flex items-center gap-1 text-sm text-destructive">
              <TriangleAlert className="size-4" /> {state.error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" variant="outline">
              <Eye className="size-4" /> {t("preview")}
            </Button>
            <Button type="submit" formAction={action} disabled={pending}>
              {provider ? <Send className="size-4" /> : <FileText className="size-4" />}
              {pending ? t("working") : provider ? t("createSend") : t("create")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Erstellten Brief (Entwurf/Fehler) nachträglich versenden. */
export function LetterSendDialog({ id, providers }: { id: string; providers: ProviderInfo[] }) {
  const t = useTranslations("letters");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(safe(sendLetter, tc("actionFailed")), {});
  useDone(state, () => {
    setOpen(false);
    toast.success(t("sent"));
    router.refresh();
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        <Send className="size-4" /> {t("send")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("send")}</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={id} />
          <ShippingFields providers={providers} allowNone={false} onProvider={() => {}} />
          {state.error && (
            <p className="flex items-center gap-1 text-sm text-destructive">
              <TriangleAlert className="size-4" /> {state.error}
            </p>
          )}
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              <Send className="size-4" /> {pending ? t("working") : t("send")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function LetterRefreshButton() {
  const t = useTranslations("letters");
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionState, FormData>(refreshLetters, {});
  useDone(state, () => router.refresh());
  return (
    <form action={action}>
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        <RefreshCw className={cn("size-4", pending && "animate-spin")} /> {t("refresh")}
      </Button>
    </form>
  );
}
