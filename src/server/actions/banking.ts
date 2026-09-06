"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireRole, requireWriter } from "@/lib/rbac";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import * as eb from "@/lib/adapters/enablebanking";
import type { ActionState } from "@/lib/schemas";

async function originUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Redirect-URI, die beim Enable-Banking-App-Setup hinterlegt werden muss. */
export async function bankRedirectUrl() {
  return `${await originUrl()}/api/banking/callback`;
}

async function connectorFor(tenantId: string): Promise<eb.Connector | null> {
  const c = await prisma.bankConnector.findUnique({ where: { tenantId } });
  if (!c) return null;
  return { applicationId: c.applicationId, privateKeyPem: decryptSecret(c.privateKeyEnc), baseUrl: c.baseUrl ?? undefined };
}

export async function saveBankConnector(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireRole(["ADMIN"]);
  const applicationId = String(fd.get("applicationId") ?? "").trim();
  const privateKey = String(fd.get("privateKey") ?? "").trim();
  const baseUrl = String(fd.get("baseUrl") ?? "").trim() || null;
  const psuType = String(fd.get("psuType") ?? "business").trim() || "business";
  if (!applicationId) return { error: "Application ID fehlt" };

  const existing = await prisma.bankConnector.findUnique({ where: { tenantId: user.tenantId } });
  // Private Key nur überschreiben, wenn ein neuer eingegeben wurde.
  if (!existing && !privateKey) return { error: "Private Key fehlt" };
  const privateKeyEnc = privateKey ? encryptSecret(privateKey) : existing!.privateKeyEnc;

  await prisma.bankConnector.upsert({
    where: { tenantId: user.tenantId },
    create: { tenantId: user.tenantId, applicationId, privateKeyEnc, baseUrl, psuType },
    update: { applicationId, privateKeyEnc, baseUrl, psuType },
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteBankConnector(): Promise<void> {
  const user = await requireRole(["ADMIN"]);
  await prisma.bankConnector.deleteMany({ where: { tenantId: user.tenantId } });
  revalidatePath("/", "layout");
}

/** Banken (ASPSPs) für die Auswahl laden. */
export async function listBankAspsps(country: string): Promise<{ ok?: boolean; error?: string; banks?: string[] }> {
  const user = await requireWriter();
  const conn = await connectorFor(user.tenantId);
  if (!conn) return { error: "Kein Bank-Connector konfiguriert" };
  try {
    const res = await eb.listAspsps(conn, country || undefined);
    const banks = [...new Set((res.aspsps ?? []).map((a) => a.name))].sort();
    return { ok: true, banks };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Bankliste fehlgeschlagen" };
  }
}

/** Consent-Flow starten → Weiterleitung zur Bank. */
export async function startBankAuth(fd: FormData): Promise<void> {
  const user = await requireWriter();
  const aspspName = String(fd.get("aspspName") ?? "").trim();
  const aspspCountry = String(fd.get("aspspCountry") ?? "DE").trim().toUpperCase();
  if (!aspspName) return;
  const row = await prisma.bankConnector.findUnique({ where: { tenantId: user.tenantId } });
  if (!row) return;
  const conn: eb.Connector = { applicationId: row.applicationId, privateKeyPem: decryptSecret(row.privateKeyEnc), baseUrl: row.baseUrl ?? undefined };

  const state = randomUUID();
  await prisma.bankAuthState.create({ data: { state, tenantId: user.tenantId, aspspName, aspspCountry } });
  const validUntil = new Date(Date.now() + 90 * 86_400_000).toISOString().replace("Z", "000+00:00");
  const res = await eb.startAuth(conn, {
    aspspName,
    country: aspspCountry,
    redirectUrl: `${await originUrl()}/api/banking/callback`,
    state,
    psuType: row.psuType,
    validUntil,
  });
  redirect(res.url);
}

/** Transaktionen einer Verknüpfung abrufen, als Zahlungen buchen, zuordnen. */
export async function syncBankLink(fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const id = String(fd.get("id") ?? "");
  const link = await prisma.bankLink.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!link) return { error: "Verknüpfung nicht gefunden" };
  const conn = await connectorFor(user.tenantId);
  if (!conn) return { error: "Kein Bank-Connector konfiguriert" };

  const from = link.lastSyncAt ?? new Date(Date.now() - 90 * 86_400_000);
  const dateFrom = from.toISOString().slice(0, 10);

  let raw;
  try {
    raw = await eb.getTransactions(conn, link.accountUid, dateFrom);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Abruf fehlgeschlagen" };
  }

  // Offene Sollstellungen für Auto-Zuordnung (wie camt.053-Import).
  const charges = await prisma.charge.findMany({
    where: { tenantId: user.tenantId },
    include: { payments: { select: { amount: true } } },
  });
  const openMap = charges.map((c) => ({
    id: c.id,
    open: Number(c.amount) - c.payments.reduce((a, p) => a + Number(p.amount), 0),
  }));

  let imported = 0;
  let matched = 0;
  for (const t of raw) {
    const m = eb.mapTransaction(t);
    if (!m.externalId || !m.date || m.amount <= 0) continue;
    // Dedup: bereits importierte externe Transaktion überspringen.
    const dup = await prisma.payment.findFirst({ where: { tenantId: user.tenantId, externalId: m.externalId }, select: { id: true } });
    if (dup) continue;
    let chargeId: string | null = null;
    if (m.direction === "EINGANG") {
      const hit = openMap.find((o) => o.open > 0 && Math.abs(o.open - m.amount) < 0.005);
      if (hit) {
        chargeId = hit.id;
        hit.open = 0;
        matched++;
      }
    }
    await prisma.payment.create({
      data: {
        tenantId: user.tenantId,
        accountId: link.accountId,
        chargeId,
        date: new Date(m.date),
        amount: m.amount,
        direction: m.direction,
        reference: m.reference,
        externalId: m.externalId,
      },
    });
    imported++;
  }
  await prisma.bankLink.update({ where: { id: link.id }, data: { lastSyncAt: new Date() } });
  revalidatePath("/", "layout");
  return { ok: true, error: `${imported} Buchungen importiert, ${matched} zugeordnet` };
}

export async function deleteBankLink(fd: FormData): Promise<void> {
  const user = await requireWriter();
  await prisma.bankLink.deleteMany({ where: { id: String(fd.get("id") ?? ""), tenantId: user.tenantId } });
  revalidatePath("/", "layout");
}
