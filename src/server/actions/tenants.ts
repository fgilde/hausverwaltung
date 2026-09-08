"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/rbac";
import { ensureDefaultAccounts } from "@/lib/accounts";
import { ACTING_TENANT_COOKIE } from "@/lib/acting-tenant";
import type { ActionState } from "@/lib/schemas";

// Neuen Mandanten + ersten Admin anlegen (nur Instanz-Admin).
export async function createTenant(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireSuperAdmin();
  const name = String(fd.get("name") ?? "").trim();
  const adminName = String(fd.get("adminName") ?? "").trim() || "Admin";
  const email = String(fd.get("adminEmail") ?? "").trim().toLowerCase();
  const password = String(fd.get("adminPassword") ?? "");
  if (!name) return { error: "Mandantenname fehlt" };
  if (!/.+@.+\..+/.test(email)) return { error: "Ungültige E-Mail" };
  if (password.length < 6) return { error: "Passwort mind. 6 Zeichen" };
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } }))
    return { error: "E-Mail bereits vergeben" };

  const tenant = await prisma.tenant.create({
    data: {
      name,
      users: { create: { name: adminName, email, passwordHash: await bcrypt.hash(password, 10), role: "ADMIN" } },
    },
  });
  await ensureDefaultAccounts(prisma, tenant.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

// In einen Mandanten wechseln (leer = zurück zum eigenen). Nur Instanz-Admin.
export async function switchTenant(fd: FormData): Promise<void> {
  const user = await requireSuperAdmin();
  const target = String(fd.get("tenantId") ?? "").trim();
  const jar = await cookies();
  if (!target || target === user.homeTenantId) {
    jar.delete(ACTING_TENANT_COOKIE);
  } else {
    const exists = await prisma.tenant.findUnique({ where: { id: target }, select: { id: true } });
    if (exists) jar.set(ACTING_TENANT_COOKIE, target, { httpOnly: true, sameSite: "lax", path: "/" });
  }
  revalidatePath("/", "layout");
}

// Mandanten löschen (nur Instanz-Admin; nicht den eigenen).
export async function deleteTenant(fd: FormData): Promise<void> {
  const user = await requireSuperAdmin();
  const id = String(fd.get("id") ?? "");
  if (!id || id === user.homeTenantId) return; // eigenen Mandanten nie löschen
  if (id === user.tenantId) (await cookies()).delete(ACTING_TENANT_COOKIE); // ggf. Wechsel aufheben
  await prisma.tenant.delete({ where: { id } }).catch(() => {});
  revalidatePath("/", "layout");
}
