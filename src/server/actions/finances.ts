"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/rbac";
import {
  accountSchema,
  chargeSchema,
  paymentSchema,
  mandateSchema,
  generateSchema,
  type ActionState,
} from "@/lib/schemas";
import { parseCamt053 } from "@/lib/adapters/bankImport";
import { audit } from "@/lib/audit";
import { simplePdf } from "@/lib/pdf";
import { saveFile } from "@/lib/storage";
import { money, date } from "@/lib/format";

function fail(msg?: string): ActionState {
  return { error: msg ?? "Ungültige Eingabe" };
}
function done(): ActionState {
  revalidatePath("/", "layout");
  return { ok: true };
}

// --- Account ---
export async function createAccount(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const r = accountSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return fail(r.error.issues[0]?.message);
  await prisma.account.create({ data: { ...r.data, tenantId: user.tenantId } });
  return done();
}
export async function deleteAccount(fd: FormData): Promise<void> {
  const user = await requireWriter();
  await prisma.account.deleteMany({ where: { id: String(fd.get("id") ?? ""), tenantId: user.tenantId } });
  revalidatePath("/", "layout");
}

// --- Charge (manuell) ---
export async function createCharge(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const r = chargeSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return fail(r.error.issues[0]?.message);
  await prisma.charge.create({ data: { ...r.data, tenantId: user.tenantId } });
  return done();
}
export async function deleteCharge(fd: FormData): Promise<void> {
  const user = await requireWriter();
  await prisma.charge.deleteMany({ where: { id: String(fd.get("id") ?? ""), tenantId: user.tenantId } });
  revalidatePath("/", "layout");
}

// --- Sollstellungslauf: Miete für aktive Verträge eines Monats ---
export async function generateCharges(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const r = generateSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return fail(r.error.issues[0]?.message);
  const [y, m] = r.data.month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const last = new Date(Date.UTC(y, m, 0));
  const due = new Date(Date.UTC(y, m - 1, 3));

  const leases = await prisma.lease.findMany({
    where: {
      tenantId: user.tenantId,
      startDate: { lte: last },
      OR: [{ endDate: null }, { endDate: { gte: first } }],
    },
    include: { components: { select: { amount: true } }, charges: { where: { period: first, type: "MIETE" }, select: { id: true } } },
  });

  let created = 0;
  for (const l of leases) {
    if (l.charges.length > 0) continue; // schon vorhanden
    const warm = Number(l.rentCold) + l.components.reduce((a, c) => a + Number(c.amount), 0);
    await prisma.charge.create({
      data: {
        tenantId: user.tenantId,
        leaseId: l.id,
        type: "MIETE",
        period: first,
        dueDate: due,
        amount: warm,
      },
    });
    created++;
  }
  revalidatePath("/", "layout");
  return { ok: true, error: created === 0 ? "Keine neuen Sollstellungen (bereits vorhanden)" : undefined };
}

// --- Payment ---
export async function createPayment(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const r = paymentSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return fail(r.error.issues[0]?.message);
  // Zugehörigkeit prüfen (Charge/Account des Mandanten)
  if (r.data.chargeId) {
    const c = await prisma.charge.findFirst({ where: { id: r.data.chargeId, tenantId: user.tenantId }, select: { id: true } });
    if (!c) return fail("Sollstellung nicht gefunden");
  }
  await prisma.payment.create({ data: { ...r.data, tenantId: user.tenantId } });
  return done();
}
export async function deletePayment(fd: FormData): Promise<void> {
  const user = await requireWriter();
  await prisma.payment.deleteMany({ where: { id: String(fd.get("id") ?? ""), tenantId: user.tenantId } });
  revalidatePath("/", "layout");
}

// --- SEPA-Mandat ---
export async function createMandate(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const r = mandateSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return fail(r.error.issues[0]?.message);
  const p = await prisma.person.findFirst({ where: { id: r.data.personId, tenantId: user.tenantId }, select: { id: true } });
  if (!p) return fail("Person nicht gefunden");
  await prisma.sepaMandate.create({ data: { ...r.data, tenantId: user.tenantId } });
  return done();
}
export async function deleteMandate(fd: FormData): Promise<void> {
  const user = await requireWriter();
  await prisma.sepaMandate.deleteMany({ where: { id: String(fd.get("id") ?? ""), tenantId: user.tenantId } });
  revalidatePath("/", "layout");
}

// --- camt.053 Bankimport mit naivem Auto-Matching ---
export async function importCamt(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Keine Datei");
  const accountId = String(fd.get("accountId") ?? "") || null;

  let entries;
  try {
    entries = parseCamt053(await file.text());
  } catch {
    return fail("camt.053 konnte nicht gelesen werden");
  }
  if (entries.length === 0) return fail("Keine Buchungen in der Datei");

  // offene Beträge je Sollstellung für Auto-Matching
  const charges = await prisma.charge.findMany({
    where: { tenantId: user.tenantId },
    include: { payments: { select: { amount: true } } },
  });
  const openMap = charges.map((c) => ({
    id: c.id,
    open: Number(c.amount) - c.payments.reduce((a, p) => a + Number(p.amount), 0),
  }));

  let matched = 0;
  for (const e of entries) {
    let chargeId: string | null = null;
    if (e.direction === "EINGANG") {
      const hit = openMap.find((o) => o.open > 0 && Math.abs(o.open - e.amount) < 0.005);
      if (hit) {
        chargeId = hit.id;
        hit.open = 0; // verbraucht
        matched++;
      }
    }
    await prisma.payment.create({
      data: {
        tenantId: user.tenantId,
        accountId,
        chargeId,
        date: new Date(e.date),
        amount: e.amount,
        direction: e.direction,
        reference: e.reference,
      },
    });
  }
  revalidatePath("/", "layout");
  return { ok: true, error: `${entries.length} Buchungen, ${matched} zugeordnet` };
}

// --- Mahnung: nächste Stufe für überfällige Sollstellung ---
const DUNNING_FEE: Record<number, number> = { 1: 0, 2: 5, 3: 10 };
export async function createDunning(fd: FormData): Promise<void> {
  const user = await requireWriter();
  const chargeId = String(fd.get("chargeId") ?? "");
  const charge = await prisma.charge.findFirst({
    where: { id: chargeId, tenantId: user.tenantId },
    include: { dunnings: { select: { level: true } } },
  });
  if (charge) {
    const level = Math.min(charge.dunnings.length + 1, 3);
    await prisma.dunningNotice.create({
      data: { tenantId: user.tenantId, chargeId, level, fee: DUNNING_FEE[level] ?? 0 },
    });
  }
  revalidatePath("/", "layout");
}

// --- Mahnung als PDF an den Mieter mailen (Entwurf im Postausgang) + Ablage ---
export async function emailDunning(fd: FormData): Promise<void> {
  const user = await requireWriter();
  const chargeId = String(fd.get("chargeId") ?? "");
  const charge = await prisma.charge.findFirst({
    where: { id: chargeId, tenantId: user.tenantId },
    include: {
      payments: { select: { amount: true } },
      dunnings: { orderBy: { level: "desc" }, take: 1 },
      lease: {
        include: {
          unit: { include: { building: { include: { property: { include: { tenant: true } } } } } },
          renters: { include: { person: true } },
        },
      },
    },
  });
  if (!charge || !charge.lease) return;

  const paid = charge.payments.reduce((a, p) => a + Number(p.amount), 0);
  const open = Number(charge.amount) - paid;
  const dun = charge.dunnings[0];
  const fee = dun ? Number(dun.fee) : 0;
  const total = open + fee;
  const level = dun?.level ?? 1;
  const property = charge.lease.unit.building.property;
  const renter = charge.lease.renters[0]?.person;
  if (!renter?.email) return; // ohne E-Mail kein Entwurf

  const title = level >= 2 ? `${level}. Mahnung` : "Zahlungserinnerung";
  const pdf = simplePdf(title, [
    `${property.name} - ${charge.lease.unit.label}`,
    `Mieter: ${renter.firstName} ${renter.lastName}`,
    "",
    `Offener Posten (faellig ${date(charge.dueDate)}): ${money(open)}`,
    fee > 0 ? `Mahngebuehr: ${money(fee)}` : "",
    `Offener Gesamtbetrag: ${money(total)}`,
    "",
    "Wir bitten um Ausgleich innerhalb von 14 Tagen.",
  ].filter(Boolean));
  const name = `${title} - ${charge.lease.unit.label}.pdf`;
  const storageKey = await saveFile(pdf, name);
  const doc = await prisma.document.create({
    data: {
      tenantId: user.tenantId,
      propertyId: property.id,
      name,
      category: "SONSTIGES",
      mime: "application/pdf",
      size: pdf.length,
      storageKey,
    },
  });
  await prisma.emailMessage.create({
    data: {
      tenantId: user.tenantId,
      toAddress: renter.email,
      subject: `${title} · ${property.name}`,
      body: `Sehr geehrte/r ${renter.firstName} ${renter.lastName},\n\nanbei ${title.toLowerCase()} über ${money(total)}.\n\nMit freundlichen Grüßen\n${property.tenant.name}`,
      status: "ENTWURF",
      attachments: { create: [{ documentId: doc.id }] },
    },
  });
  await audit(user, "CREATE", "EmailMessage", null, `${title} ${charge.lease.unit.label}`);
  revalidatePath("/", "layout");
}
