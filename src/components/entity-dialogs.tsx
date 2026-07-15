import { Plus, Pencil } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { CrudDialog } from "@/components/crud-dialog";
import { TextField, SelectField } from "@/components/form-fields";
import {
  createProperty,
  updateProperty,
  createBuilding,
  updateBuilding,
  createUnit,
  updateUnit,
  createMeter,
  createReading,
} from "@/server/actions/objects";
import { createPerson, updatePerson } from "@/server/actions/persons";

function CreateTrigger({ label }: { label: string }) {
  return (
    <Button size="sm">
      <Plus className="size-4" />
      {label}
    </Button>
  );
}

function EditTrigger({ label }: { label: string }) {
  return (
    <Button variant="ghost" size="icon" aria-label={label}>
      <Pencil className="size-4" />
    </Button>
  );
}

async function opts(ns: string, keys: string[]) {
  const t = await getTranslations(ns);
  return keys.map((k) => ({ value: k, label: t(k) }));
}

type PropertyData = {
  id: string;
  name: string;
  street: string;
  zip: string;
  city: string;
  type: string;
  management: string;
};

export async function PropertyDialog({ property }: { property?: PropertyData }) {
  const t = await getTranslations();
  const edit = !!property;
  return (
    <CrudDialog
      trigger={edit ? <EditTrigger label={t("common.edit")} /> : <CreateTrigger label={t("properties.new")} />}
      title={edit ? t("properties.edit") : t("properties.new")}
      action={edit ? updateProperty : createProperty}
      submitLabel={edit ? t("common.save") : t("common.create")}
    >
      {edit && <input type="hidden" name="id" value={property!.id} />}
      <TextField name="name" label={t("fields.name")} defaultValue={property?.name} />
      <TextField name="street" label={t("fields.street")} defaultValue={property?.street} />
      <div className="grid grid-cols-2 gap-4">
        <TextField name="zip" label={t("fields.zip")} defaultValue={property?.zip} />
        <TextField name="city" label={t("fields.city")} defaultValue={property?.city} />
      </div>
      <SelectField
        name="type"
        label={t("fields.type")}
        defaultValue={property?.type ?? "WOHNEN"}
        options={await opts("propertyType", ["WOHNEN", "GEWERBE", "GEMISCHT"])}
      />
      <SelectField
        name="management"
        label={t("fields.management")}
        defaultValue={property?.management ?? "MIET"}
        options={await opts("managementType", ["MIET", "WEG"])}
      />
    </CrudDialog>
  );
}

export async function BuildingDialog({
  propertyId,
  building,
}: {
  propertyId: string;
  building?: { id: string; name: string };
}) {
  const t = await getTranslations();
  const edit = !!building;
  return (
    <CrudDialog
      trigger={edit ? <EditTrigger label={t("common.edit")} /> : <CreateTrigger label={t("buildings.new")} />}
      title={edit ? t("buildings.edit") : t("buildings.new")}
      action={edit ? updateBuilding : createBuilding}
      submitLabel={edit ? t("common.save") : t("common.create")}
    >
      {edit ? (
        <input type="hidden" name="id" value={building!.id} />
      ) : (
        <input type="hidden" name="propertyId" value={propertyId} />
      )}
      <TextField name="name" label={t("fields.name")} defaultValue={building?.name} />
    </CrudDialog>
  );
}

type UnitData = {
  id: string;
  label: string;
  type: string;
  area: string;
  rooms?: string;
  mea?: string;
};

export async function UnitDialog({
  buildingId,
  unit,
}: {
  buildingId: string;
  unit?: UnitData;
}) {
  const t = await getTranslations();
  const edit = !!unit;
  return (
    <CrudDialog
      trigger={edit ? <EditTrigger label={t("common.edit")} /> : <CreateTrigger label={t("units.new")} />}
      title={edit ? t("units.edit") : t("units.new")}
      action={edit ? updateUnit : createUnit}
      submitLabel={edit ? t("common.save") : t("common.create")}
    >
      {edit ? (
        <input type="hidden" name="id" value={unit!.id} />
      ) : (
        <input type="hidden" name="buildingId" value={buildingId} />
      )}
      <TextField name="label" label={t("fields.label")} defaultValue={unit?.label} />
      <SelectField
        name="type"
        label={t("fields.type")}
        defaultValue={unit?.type ?? "WOHNUNG"}
        options={await opts("unitType", ["WOHNUNG", "GEWERBE", "STELLPLATZ", "KELLER", "SONSTIGES"])}
      />
      <div className="grid grid-cols-2 gap-4">
        <TextField name="area" label={t("fields.area")} type="number" step="0.01" defaultValue={unit?.area} />
        <TextField
          name="rooms"
          label={t("fields.rooms")}
          type="number"
          step="0.5"
          required={false}
          defaultValue={unit?.rooms}
        />
      </div>
      <TextField
        name="mea"
        label={t("fields.mea")}
        type="number"
        required={false}
        defaultValue={unit?.mea}
      />
    </CrudDialog>
  );
}

type PersonData = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
};

export async function PersonDialog({ person }: { person?: PersonData }) {
  const t = await getTranslations();
  const edit = !!person;
  return (
    <CrudDialog
      trigger={edit ? <EditTrigger label={t("common.edit")} /> : <CreateTrigger label={t("persons.new")} />}
      title={edit ? t("persons.edit") : t("persons.new")}
      action={edit ? updatePerson : createPerson}
      submitLabel={edit ? t("common.save") : t("common.create")}
    >
      {edit && <input type="hidden" name="id" value={person!.id} />}
      <div className="grid grid-cols-2 gap-4">
        <TextField name="firstName" label={t("fields.firstName")} defaultValue={person?.firstName} />
        <TextField name="lastName" label={t("fields.lastName")} defaultValue={person?.lastName} />
      </div>
      <TextField
        name="email"
        label={t("fields.email")}
        type="email"
        required={false}
        defaultValue={person?.email ?? undefined}
      />
      <TextField
        name="phone"
        label={t("fields.phone")}
        required={false}
        defaultValue={person?.phone ?? undefined}
      />
    </CrudDialog>
  );
}

export async function MeterDialog({ unitId }: { unitId: string }) {
  const t = await getTranslations();
  return (
    <CrudDialog
      trigger={<CreateTrigger label={t("unitDetail.newMeter")} />}
      title={t("unitDetail.newMeter")}
      action={createMeter}
      submitLabel={t("common.create")}
    >
      <input type="hidden" name="unitId" value={unitId} />
      <SelectField
        name="type"
        label={t("fields.meterType")}
        defaultValue="STROM"
        options={await opts("meterType", ["STROM", "GAS", "WASSER_KALT", "WASSER_WARM", "WAERME"])}
      />
      <TextField name="serialNo" label={t("fields.serialNo")} />
    </CrudDialog>
  );
}

export async function ReadingDialog({ meterId }: { meterId: string }) {
  const t = await getTranslations();
  return (
    <CrudDialog
      trigger={
        <Button variant="outline" size="sm">
          <Plus className="size-4" />
          {t("unitDetail.newReading")}
        </Button>
      }
      title={t("unitDetail.newReading")}
      action={createReading}
      submitLabel={t("common.create")}
    >
      <input type="hidden" name="meterId" value={meterId} />
      <TextField name="date" label={t("fields.date")} type="date" />
      <TextField name="value" label={t("fields.value")} type="number" step="0.001" />
    </CrudDialog>
  );
}
