"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, assignableRoles, canDeleteUser } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { userCreateSchema, type ActionState } from "@/lib/schemas";

const MANAGE_ROLES = ["VERWALTER"] as const; // ADMIN ist via roleAllows immer dabei

export async function createUser(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireRole([...MANAGE_ROLES]);
  const r = userCreateSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Ungültige Eingabe" };
  const { name, email, password, role, personId } = r.data;

  // Rolle muss für den Ersteller zulässig sein.
  if (!assignableRoles(actor.role).includes(role)) {
    return { error: "Für diese Rolle fehlt die Berechtigung." };
  }

  // E-Mail global eindeutig.
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { error: "E-Mail-Adresse bereits vergeben." };

  // Verknüpfte Person muss zum Mandanten gehören.
  if (personId) {
    const person = await prisma.person.findFirst({
      where: { id: personId, tenantId: actor.tenantId },
      select: { id: true },
    });
    if (!person) return { error: "Person nicht gefunden." };
  }

  const created = await prisma.user.create({
    data: {
      tenantId: actor.tenantId,
      name,
      email,
      role,
      personId: personId ?? null,
      passwordHash: await bcrypt.hash(password, 10),
    },
  });
  await audit(actor, "CREATE", "User", created.id, `${name} (${role})`);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function resetPassword(_p: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await requireRole([...MANAGE_ROLES]);
  const id = String(fd.get("id") ?? "");
  const password = String(fd.get("password") ?? "");
  if (password.length < 6) return { error: "Passwort zu kurz (min. 6 Zeichen)." };

  const target = await prisma.user.findFirst({
    where: { id, tenantId: actor.tenantId },
    select: { id: true, role: true, name: true },
  });
  if (!target) return { error: "Benutzer nicht gefunden." };
  // Eigenes Passwort oder eine vom Actor verwaltbare Rolle.
  if (target.id !== actor.id && !assignableRoles(actor.role).includes(target.role)) {
    return { error: "Keine Berechtigung." };
  }
  await prisma.user.update({ where: { id: target.id }, data: { passwordHash: await bcrypt.hash(password, 10) } });
  await audit(actor, "UPDATE", "User", target.id, `Passwort zurückgesetzt: ${target.name}`);
  return { ok: true };
}

export async function deleteUser(fd: FormData): Promise<void> {
  const actor = await requireRole([...MANAGE_ROLES]);
  const id = String(fd.get("id") ?? "");
  const target = await prisma.user.findFirst({
    where: { id, tenantId: actor.tenantId },
    select: { id: true, role: true, name: true },
  });
  if (!target) return;
  if (!canDeleteUser(actor, target.role, target.id)) return; // stille Ablehnung

  await prisma.user.delete({ where: { id: target.id } });
  await audit(actor, "DELETE", "User", target.id, target.name);
  revalidatePath("/", "layout");
}
