"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import type { ActionState } from "@/lib/schemas";

/** Eigenes Passwort ändern (alle angemeldeten Rollen, inkl. Portal). */
export async function changePassword(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  if (next.length < 6) return { error: "Neues Passwort zu kurz (min. 6 Zeichen)." };

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser || !(await bcrypt.compare(current, dbUser.passwordHash))) {
    return { error: "Aktuelles Passwort ist falsch." };
  }
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(next, 10) } });
  await audit(user, "UPDATE", "User", user.id, "Passwort geändert");
  return { ok: true };
}
