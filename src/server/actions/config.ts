"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { pingAi } from "@/lib/ai";
import { verifyMailer } from "@/lib/adapters/mailer";
import type { ActionState } from "@/lib/schemas";

const str = (v: FormDataEntryValue | null) => {
  const x = String(v ?? "").trim();
  return x || undefined;
};

// --- Mandant ---

export async function updateTenantName(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireRole(["ADMIN"]);
  const name = str(fd.get("name"));
  if (!name) return { error: "Name erforderlich" };
  await prisma.tenant.update({ where: { id: user.tenantId }, data: { name } });
  await audit(user, "UPDATE", "Tenant", user.tenantId, `Name: ${name}`);
  revalidatePath("/", "layout");
  return { ok: true };
}

// --- Abrechnungs-Standards ---

export async function updateStatementDefaults(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireRole(["ADMIN"]);
  const raw = str(fd.get("heatingConsumptionPct"));
  const pct = raw ? Math.min(100, Math.max(0, parseInt(raw, 10))) : null;
  await prisma.tenant.update({ where: { id: user.tenantId }, data: { heatingConsumptionPct: pct } });
  await audit(user, "UPDATE", "Tenant", user.tenantId, "Abrechnungs-Standards");
  revalidatePath("/", "layout");
  return { ok: true };
}

// --- KI-Konfiguration ---

export async function updateAiConfig(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireRole(["ADMIN"]);
  const apiKey = str(fd.get("aiApiKey")); // leer = unverändert lassen
  const model = str(fd.get("aiModel"));
  const provider = str(fd.get("aiProvider"));
  const baseUrl = str(fd.get("aiBaseUrl"));
  await prisma.tenant.update({
    where: { id: user.tenantId },
    data: {
      aiProvider: provider ?? null,
      aiBaseUrl: baseUrl ?? null,
      aiModel: model ?? null,
      ...(apiKey ? { aiApiKey: apiKey } : {}),
    },
  });
  await audit(user, "UPDATE", "Tenant", user.tenantId, "KI-Konfiguration");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function testAiConfig(_p: ActionState, _fd: FormData): Promise<ActionState> {
  const user = await requireRole(["ADMIN"]);
  const t = await prisma.tenant.findUnique({
    where: { id: user.tenantId },
    select: { aiProvider: true, aiBaseUrl: true, aiApiKey: true, aiModel: true },
  });
  try {
    await pingAi({ provider: t?.aiProvider, baseUrl: t?.aiBaseUrl, apiKey: t?.aiApiKey, model: t?.aiModel });
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "KI-Test fehlgeschlagen" };
  }
}

// --- SMTP-Konfiguration ---

export async function updateSmtpConfig(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireRole(["ADMIN"]);
  const password = str(fd.get("smtpPassword")); // leer = unverändert lassen
  const portRaw = str(fd.get("smtpPort"));
  await prisma.tenant.update({
    where: { id: user.tenantId },
    data: {
      smtpHost: str(fd.get("smtpHost")) ?? null,
      smtpPort: portRaw ? Number(portRaw) : null,
      smtpUser: str(fd.get("smtpUser")) ?? null,
      smtpFrom: str(fd.get("smtpFrom")) ?? null,
      smtpSecure: String(fd.get("smtpSecure")) === "true",
      ...(password ? { smtpPassword: password } : {}),
    },
  });
  await audit(user, "UPDATE", "Tenant", user.tenantId, "SMTP-Konfiguration");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function testSmtpConfig(_p: ActionState, _fd: FormData): Promise<ActionState> {
  const user = await requireRole(["ADMIN"]);
  const t = await prisma.tenant.findUnique({
    where: { id: user.tenantId },
    select: {
      smtpHost: true, smtpPort: true, smtpUser: true,
      smtpPassword: true, smtpFrom: true, smtpSecure: true,
    },
  });
  try {
    await verifyMailer({
      host: t?.smtpHost, port: t?.smtpPort, user: t?.smtpUser,
      password: t?.smtpPassword, from: t?.smtpFrom, secure: t?.smtpSecure,
    });
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "SMTP-Test fehlgeschlagen" };
  }
}
