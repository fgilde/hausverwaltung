"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Upload, Download, Save } from "lucide-react";
import {
  importMapped,
  saveImportPreset,
  deleteImportPreset,
  type ImportState,
} from "@/server/actions/imports";
import { parseCsv } from "@/lib/csv";
import { mapColumns, missingRequired, ENTITY_FIELDS, ENTITY_SPEC } from "@/lib/import-columns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DeleteButton } from "@/components/delete-button";
import { cn } from "@/lib/utils";

type Entity = "person" | "property" | "unit";
type Preset = { id: string; name: string; mapping: Record<string, number> };

const TITLE = { person: "personsTitle", property: "propertiesTitle", unit: "unitsTitle" } as const;
const HINT = { person: "personsHint", property: "propertiesHint", unit: "unitsHint" } as const;

const selectCls = cn(
  "flex h-9 w-full rounded-lg border border-input bg-transparent px-2 text-sm shadow-xs",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none dark:bg-input/30",
);

export function ImportDialog({ entity, presets = [] }: { entity: Entity; presets?: Preset[] }) {
  const t = useTranslations("import");
  const tf = useTranslations("import.fields");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [header, setHeader] = useState<string[] | null>(null);
  const [preview, setPreview] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [presetName, setPresetName] = useState("");
  const [state, action, pending] = useActionState<ImportState, FormData>(importMapped, {});
  const [savePending, startSave] = useTransition();

  const fields = [...ENTITY_FIELDS[entity].required, ...ENTITY_FIELDS[entity].optional];
  const requiredSet = new Set(ENTITY_FIELDS[entity].required);
  const missing = header ? missingRequired(entity, mapping) : [];

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) {
      setHeader(null);
      return;
    }
    const rows = parseCsv(await f.text());
    if (rows.length === 0) {
      setHeader(null);
      toast.error(t("emptyFile"));
      return;
    }
    setHeader(rows[0]);
    setPreview(rows.slice(1, 4));
    setMapping(mapColumns(rows[0], ENTITY_SPEC[entity]));
  }

  function reset() {
    setHeader(null);
    setPreview([]);
    setMapping({});
    setPresetName("");
  }
  function onOpenChange(v: boolean) {
    setOpen(v);
    if (!v) reset();
  }

  function applyPreset(id: string) {
    const p = presets.find((x) => x.id === id);
    if (p) setMapping({ ...p.mapping });
  }

  function savePreset() {
    const name = presetName.trim();
    if (!name) return;
    const fd = new FormData();
    fd.set("entity", entity);
    fd.set("name", name);
    fd.set("mapping", JSON.stringify(mapping));
    startSave(async () => {
      const r = await saveImportPreset({}, fd);
      if (r.error) toast.error(r.error);
      else {
        toast.success(t("presetSaved"));
        setPresetName("");
        router.refresh();
      }
    });
  }

  useEffect(() => {
    if (state.ok) {
      toast.success(t("done", { created: state.created ?? 0, skipped: state.skipped ?? 0 }));
      setOpen(false);
      reset();
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Upload className="size-4" />
            {t("csv")}
          </Button>
        }
      />
      <DialogContent className="max-h-[85vh] w-[95vw] max-w-2xl overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t(TITLE[entity])}</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="entity" value={entity} />
          <input type="hidden" name="mapping" value={JSON.stringify(mapping)} />

          <p className="text-xs text-muted-foreground">{t(HINT[entity])}</p>
          <a
            href={`/api/import-template/${entity}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <Download className="size-3.5" /> {t("template")}
          </a>

          {presets.length > 0 && (
            <div className="space-y-1.5">
              <Label>{t("presets")}</Label>
              <div className="flex flex-wrap items-center gap-1.5">
                {presets.map((p) => (
                  <span key={p.id} className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
                    <button type="button" className="hover:underline" onClick={() => applyPreset(p.id)}>
                      {p.name}
                    </button>
                    <DeleteButton action={deleteImportPreset} id={p.id} />
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="file">{t("file")}</Label>
            <Input id="file" name="file" type="file" accept=".csv,text/csv" required onChange={onFile} />
          </div>

          {header && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>{t("mapColumns")}</Label>
                <div className="grid gap-2">
                  {fields.map((field) => (
                    <div key={field} className="grid grid-cols-2 items-center gap-2">
                      <span className="text-sm">
                        {tf(field)}
                        {requiredSet.has(field) && <span className="text-destructive"> *</span>}
                      </span>
                      <select
                        value={mapping[field] ?? -1}
                        onChange={(e) => setMapping((m) => ({ ...m, [field]: Number(e.target.value) }))}
                        className={selectCls}
                      >
                        <option value={-1}>— {t("notMapped")} —</option>
                        {header.map((h, i) => (
                          <option key={i} value={i}>
                            {h || `${t("column")} ${i + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {preview.length > 0 && (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        {header.map((h, i) => (
                          <th key={i} className="px-2 py-1 text-left font-medium">{h || i + 1}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((r, ri) => (
                        <tr key={ri} className="border-b last:border-b-0">
                          {header.map((_, ci) => (
                            <td key={ci} className="max-w-[10rem] truncate px-2 py-1 text-muted-foreground">{r[ci] ?? ""}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="presetName" className="text-xs text-muted-foreground">{t("savePreset")}</Label>
                  <Input
                    id="presetName"
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder={t("presetNamePlaceholder")}
                  />
                </div>
                <Button type="button" variant="outline" onClick={savePreset} disabled={savePending || !presetName.trim()}>
                  <Save className="size-4" /> {t("save")}
                </Button>
              </div>
            </div>
          )}

          {missing.length > 0 && (
            <p className="text-sm text-destructive">
              {t("missingFields", { fields: missing.map((f) => tf(f)).join(", ") })}
            </p>
          )}
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={pending || !header || missing.length > 0}>
              {t("run")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
