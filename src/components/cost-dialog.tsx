import { Pencil, Plus, Receipt } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { CrudDialog } from "@/components/crud-dialog";
import { TextField, SelectField } from "@/components/form-fields";
import { createCost, updateCost } from "@/server/actions/costs";
import { ScopeField } from "@/components/weg-dialogs";

const COST_TYPES = [
  "GRUNDSTEUER", "WASSER", "ENTWAESSERUNG", "HEIZUNG", "WARMWASSER", "AUFZUG",
  "STRASSENREINIGUNG", "MUELL", "GEBAEUDEREINIGUNG", "GARTENPFLEGE", "BELEUCHTUNG",
  "SCHORNSTEIN", "VERSICHERUNG", "HAUSWART", "KABEL", "INSTANDHALTUNG", "VERWALTUNG", "SONSTIGE",
];
const METHODS = ["AREA", "UNITS", "PERSONS", "CONSUMPTION", "MEA"];
const UNIT_TYPES = ["WOHNUNG", "GEWERBE", "STELLPLATZ", "KELLER", "SONSTIGES"];

/** Vorhandene Position zum Bearbeiten (#97). */
export type CostEdit = {
  id: string;
  type: string;
  amount: number;
  method: string;
  umlagefaehig: boolean;
  subcommunityId: string | null;
  unitTypes: string[];
  consumptionSharePct: number | null;
  note: string | null;
};

export async function CostDialog({
  propertyId,
  year,
  subcommunities = [],
  properties,
  defaults,
  cost,
}: {
  propertyId?: string | null;
  year: number;
  subcommunities?: { value: string; label: string }[]; // Untergemeinschaften (#42)
  /** Aus Dokument (#64): Objekt und Jahr wählbar, Betrag/Notiz vorbefüllt. */
  properties?: { value: string; label: string }[];
  defaults?: { amount?: string; note?: string };
  cost?: CostEdit;
}) {
  const t = await getTranslations();
  const typeOpts = await getTranslations("costType").then((tt) =>
    COST_TYPES.map((k) => ({ value: k, label: tt(k) })),
  );
  const methodOpts = await getTranslations("allocationMethod").then((tt) =>
    METHODS.map((k) => ({ value: k, label: tt(k) })),
  );
  const tUnit = await getTranslations("unitType");

  return (
    <CrudDialog
      trigger={
        cost ? (
          <Button variant="ghost" size="icon" aria-label={t("common.edit")} title={t("common.edit")}>
            <Pencil className="size-4" />
          </Button>
        ) : properties ? (
          <Button variant="ghost" size="icon" aria-label={t("documents.toCost")} title={t("documents.toCost")}>
            <Receipt className="size-4" />
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="size-4" />
            {t("statements.addCost")}
          </Button>
        )
      }
      title={cost ? t("statements.editCost") : t("statements.addCost")}
      action={cost ? updateCost : createCost}
      submitLabel={cost ? t("common.save") : t("common.create")}
    >
      {cost && <input type="hidden" name="id" value={cost.id} />}
      {properties ? (
        <>
          <SelectField name="propertyId" label={t("units.property")} options={properties} defaultValue={propertyId ?? undefined} />
          <TextField name="year" label={t("statements.year")} type="number" defaultValue={year} />
        </>
      ) : (
        <>
          <input type="hidden" name="propertyId" value={propertyId ?? ""} />
          <input type="hidden" name="year" value={year} />
        </>
      )}
      <SelectField name="type" label={t("fields.type")} options={typeOpts} defaultValue={cost?.type} />
      <TextField name="amount" label={t("fields.amount")} type="number" step="0.01" defaultValue={cost?.amount ?? defaults?.amount} />
      <SelectField name="method" label={t("statements.method")} options={methodOpts} defaultValue={cost?.method} />
      {subcommunities.length > 0 && (
        <ScopeField subcommunities={subcommunities} label={t("weg.scope")} wholeLabel={t("weg.wholeCommunity")} defaultValue={cost?.subcommunityId} />
      )}
      {/* Verteilerkreis nach Einheitstyp (#105): z. B. Garagentor nur auf Stellplätze */}
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">{t("statements.unitTypes")}</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {UNIT_TYPES.map((k) => (
            <label key={k} className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" name="unitTypes" value={k} defaultChecked={cost?.unitTypes.includes(k)} className="size-4" />
              {tUnit(k)}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{t("statements.unitTypesHint")}</p>
      </fieldset>
      <TextField
        name="consumptionSharePct"
        label={t("statements.consumptionShare")}
        type="number"
        required={false}
        defaultValue={cost?.consumptionSharePct ?? undefined}
      />
      <SelectField
        name="umlagefaehig"
        label={t("statements.umlagefaehig")}
        defaultValue={cost ? String(cost.umlagefaehig) : "true"}
        options={[
          { value: "true", label: t("common.yes") },
          { value: "false", label: t("common.no") },
        ]}
      />
      <TextField name="note" label={t("rentComponent.note")} required={false} defaultValue={cost?.note ?? defaults?.note} />
    </CrudDialog>
  );
}
