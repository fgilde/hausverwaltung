"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { money } from "@/lib/format";
import { statementPdfFor } from "@/server/statement-pdf";
import { saveFile } from "@/lib/storage";
import { computeStatement } from "@/server/statements";
import { queueEmails } from "@/server/outbox";
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
  const ids: string[] = [];

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

    // Einzelabrechnung mit allen Rechenschritten (#94) im Storage ablegen und als Dokument archivieren.
    // ponytail: rechnet die Abrechnung je Mietverhältnis neu; bei sehr großen Objekten einmal rechnen und durchreichen.
    const single = await statementPdfFor(user.tenantId, propertyId, year, u.key);
    if (!single) continue;
    const pdf = single.pdf;
    const name = `Abrechnung ${year} - ${u.label}.pdf`;
    const storageKey = await saveFile(pdf, name);
    const doc = await prisma.document.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        name,
        category: "ABRECHNUNG",
        mime: "application/pdf",
        size: pdf.length,
        storageKey,
      },
    });

    const msg = await prisma.emailMessage.create({
      data: {
        tenantId: user.tenantId,
        toAddress: u.renterEmails.join(", "),
        subject: `Betriebskostenabrechnung ${year} · ${u.label}`,
        body,
        status: "ENTWURF",
        attachments: { create: [{ documentId: doc.id }] },
      },
    });
    ids.push(msg.id);
  }
  if (ids.length === 0) return { error: "Keine Mieter mit E-Mail-Adresse gefunden." };
  await audit(user, "CREATE", "EmailMessage", null, `${ids.length}× Abrechnung ${year} (PDF)`);
  const notice = await queueEmails(user.tenantId, ids, user);
  revalidatePath("/", "layout");
  return { ok: true, notice };
}
