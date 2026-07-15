"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { money } from "@/lib/format";
import { computeStatement } from "@/server/statements";
import type { ActionState } from "@/lib/schemas";

function parse(fd: FormData) {
  return { propertyId: String(fd.get("propertyId") ?? ""), year: Number(fd.get("year")) || new Date().getFullYear() };
}

/** Bucht die Nachzahlungen (Saldo < 0) je Einheit als Sollstellung. */
export async function bookStatementCharges(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const { propertyId, year } = parse(fd);
  if (!propertyId) return { error: "Kein Objekt" };

  const st = await computeStatement(user.tenantId, propertyId, year);
  const desc = `NK-Nachzahlung ${year}`;
  const dueDate = new Date(Date.now() + 30 * 864e5);
  let created = 0;

  for (const u of st.units) {
    if (!u.leaseId || u.balance >= 0) continue; // nur Nachzahlungen
    // Dedup: nicht doppelt buchen
    const exists = await prisma.charge.findFirst({
      where: { tenantId: user.tenantId, leaseId: u.leaseId, description: desc },
      select: { id: true },
    });
    if (exists) continue;
    await prisma.charge.create({
      data: {
        tenantId: user.tenantId,
        leaseId: u.leaseId,
        type: "NEBENKOSTEN",
        period: new Date(Date.UTC(year, 11, 1)),
        dueDate,
        amount: Math.abs(u.balance),
        description: desc,
      },
    });
    created++;
  }
  if (created > 0) await audit(user, "CREATE", "Charge", null, `${created}× ${desc}`);
  revalidatePath("/", "layout");
  return created > 0 ? { ok: true } : { error: "Keine offenen Nachzahlungen zu buchen." };
}

/** Erstellt je Einheit mit Mieter-E-Mail einen Abrechnungs-Entwurf im Postausgang. */
export async function emailStatementToTenants(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const { propertyId, year } = parse(fd);
  if (!propertyId) return { error: "Kein Objekt" };

  const st = await computeStatement(user.tenantId, propertyId, year);
  const propName = st.property?.name ?? "";
  let created = 0;

  for (const u of st.units) {
    if (u.renterEmails.length === 0) continue;
    const kind = u.balance >= 0 ? "Guthaben" : "Nachzahlung";
    const body =
      `Sehr geehrte Mieterin, sehr geehrter Mieter,\n\n` +
      `anbei die Betriebskostenabrechnung ${year} für ${propName}, ${u.label}.\n\n` +
      `Umgelegte Kosten: ${money(u.allocated)}\n` +
      `Vorauszahlungen: ${money(u.prepayment)}\n` +
      `Ergebnis: ${money(Math.abs(u.balance))} ${kind}\n\n` +
      `Mit freundlichen Grüßen\n${st.property?.tenantName ?? ""}`;
    await prisma.emailMessage.create({
      data: {
        tenantId: user.tenantId,
        toAddress: u.renterEmails.join(", "),
        subject: `Betriebskostenabrechnung ${year} · ${u.label}`,
        body,
        status: "ENTWURF",
      },
    });
    created++;
  }
  if (created > 0) await audit(user, "CREATE", "EmailMessage", null, `${created}× Abrechnung ${year}`);
  revalidatePath("/", "layout");
  return created > 0 ? { ok: true } : { error: "Keine Mieter mit E-Mail-Adresse gefunden." };
}
