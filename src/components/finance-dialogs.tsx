import { Plus, CalendarPlus, Wallet, Upload } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { CrudDialog } from "@/components/crud-dialog";
import { TextField, SelectField } from "@/components/form-fields";
import {
  createAccount,
  createCharge,
  createPayment,
  createMandate,
  generateCharges,
  importCamt,
} from "@/server/actions/finances";

type Opt = { value: string; label: string };
const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);

async function opts(ns: string, keys: string[]): Promise<Opt[]> {
  const t = await getTranslations(ns);
  return keys.map((k) => ({ value: k, label: t(k) }));
}

export async function AccountDialog() {
  const t = await getTranslations();
  return (
    <CrudDialog
      trigger={
        <Button size="sm" variant="outline">
          <Plus className="size-4" />
          {t("finances.newAccount")}
        </Button>
      }
      title={t("finances.newAccount")}
      action={createAccount}
      submitLabel={t("common.create")}
    >
      <TextField name="name" label={t("fields.name")} />
      <SelectField
        name="type"
        label={t("fields.type")}
        options={await opts("accountType", ["BANK", "KAUTION", "RUECKLAGE", "SACHKONTO"])}
      />
      <TextField name="iban" label={t("fields.iban")} required={false} />
    </CrudDialog>
  );
}

export async function GenerateDialog() {
  const t = await getTranslations();
  return (
    <CrudDialog
      trigger={
        <Button size="sm">
          <CalendarPlus className="size-4" />
          {t("finances.generate")}
        </Button>
      }
      title={t("finances.generate")}
      action={generateCharges}
      submitLabel={t("finances.generate")}
    >
      <TextField name="month" label={t("finances.month")} type="month" defaultValue={thisMonth()} />
    </CrudDialog>
  );
}

export async function ChargeDialog({ leases }: { leases: Opt[] }) {
  const t = await getTranslations();
  return (
    <CrudDialog
      trigger={
        <Button size="sm" variant="outline">
          <Plus className="size-4" />
          {t("finances.manualCharge")}
        </Button>
      }
      title={t("finances.manualCharge")}
      action={createCharge}
      submitLabel={t("common.create")}
    >
      <SelectField
        name="leaseId"
        label={t("leases.title")}
        options={[{ value: "", label: t("common.none") }, ...leases]}
      />
      <SelectField
        name="type"
        label={t("fields.type")}
        options={await opts("chargeType", ["MIETE", "NEBENKOSTEN", "HAUSGELD", "SONSTIGES"])}
      />
      <div className="grid grid-cols-2 gap-4">
        <TextField name="period" label={t("finances.period")} type="date" defaultValue={today()} />
        <TextField name="dueDate" label={t("finances.due")} type="date" defaultValue={today()} />
      </div>
      <TextField name="amount" label={t("fields.amount")} type="number" step="0.01" />
      <TextField name="description" label={t("rentComponent.note")} required={false} />
    </CrudDialog>
  );
}

export async function PaymentDialog({
  chargeId,
  defaultAmount,
  accounts,
}: {
  chargeId: string;
  defaultAmount: number;
  accounts: Opt[];
}) {
  const t = await getTranslations();
  return (
    <CrudDialog
      trigger={
        <Button variant="ghost" size="icon" aria-label={t("finances.recordPayment")}>
          <Wallet className="size-4" />
        </Button>
      }
      title={t("finances.recordPayment")}
      action={createPayment}
      submitLabel={t("common.create")}
    >
      <input type="hidden" name="chargeId" value={chargeId} />
      <input type="hidden" name="direction" value="EINGANG" />
      <TextField name="date" label={t("fields.date")} type="date" defaultValue={today()} />
      <TextField
        name="amount"
        label={t("fields.amount")}
        type="number"
        step="0.01"
        defaultValue={defaultAmount > 0 ? defaultAmount.toFixed(2) : undefined}
      />
      <SelectField
        name="accountId"
        label={t("finances.account")}
        options={[{ value: "", label: t("common.none") }, ...accounts]}
      />
      <TextField name="reference" label={t("finances.reference")} required={false} />
    </CrudDialog>
  );
}

export async function CamtDialog({ accounts }: { accounts: Opt[] }) {
  const t = await getTranslations();
  return (
    <CrudDialog
      trigger={
        <Button size="sm" variant="outline">
          <Upload className="size-4" />
          {t("finances.importCamt")}
        </Button>
      }
      title={t("finances.importCamt")}
      action={importCamt}
      submitLabel={t("finances.importCamt")}
    >
      <TextField name="file" label="camt.053 (.xml)" type="file" />
      <SelectField
        name="accountId"
        label={t("finances.account")}
        options={[{ value: "", label: t("common.none") }, ...accounts]}
      />
    </CrudDialog>
  );
}

export async function MandateDialog({ persons }: { persons: Opt[] }) {
  const t = await getTranslations();
  return (
    <CrudDialog
      trigger={
        <Button size="sm" variant="outline">
          <Plus className="size-4" />
          {t("finances.newMandate")}
        </Button>
      }
      title={t("finances.newMandate")}
      action={createMandate}
      submitLabel={t("common.create")}
    >
      <SelectField name="personId" label={t("leases.selectPerson")} options={persons} />
      <TextField name="iban" label={t("fields.iban")} />
      <TextField name="mandateRef" label={t("fields.mandateRef")} />
      <TextField name="signedDate" label={t("fields.signedDate")} type="date" defaultValue={today()} />
    </CrudDialog>
  );
}
