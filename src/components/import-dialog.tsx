"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { importPersons, importProperties, type ImportState } from "@/server/actions/imports";
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

const ACTIONS = { person: importPersons, property: importProperties } as const;

export function ImportDialog({ entity }: { entity: "person" | "property" }) {
  const t = useTranslations("import");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ImportState, FormData>(ACTIONS[entity], {});

  useEffect(() => {
    if (state.ok) {
      toast.success(t("done", { created: state.created ?? 0, skipped: state.skipped ?? 0 }));
      setOpen(false);
      router.refresh();
    }
  }, [state, t, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Upload className="size-4" />
            {t("csv")}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t(entity === "person" ? "personsTitle" : "propertiesTitle")}</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4" key={open ? "o" : "c"}>
          <p className="text-xs text-muted-foreground">{t(entity === "person" ? "personsHint" : "propertiesHint")}</p>
          <div className="space-y-1.5">
            <Label htmlFor="file">{t("file")}</Label>
            <Input id="file" name="file" type="file" accept=".csv,text/csv" required />
          </div>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>{t("run")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
