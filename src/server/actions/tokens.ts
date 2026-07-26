"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { generateToken } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import type { ActionState } from "@/lib/schemas";

export type TokenState = ActionState & { token?: string };

const schema = z.object({
  name: z.string().trim().min(1),
  userId: z.string().trim().optional().transform((v) => (v ? v : undefined)),
});

export async function createApiToken(_p: TokenState, fd: FormData): Promise<TokenState> {
  const user = await requireUser();
  const r = schema.safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Ungültige Eingabe" };

  // Zieluser: standardmäßig man selbst. Für andere → nur ADMIN.
  let targetId = user.id;
  if (r.data.userId && r.data.userId !== user.id) {
    if (user.role !== "ADMIN") return { error: "Nur Administratoren dürfen Token für andere anlegen." };
    const target = await prisma.user.findFirst({
      where: { id: r.data.userId, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!target) return { error: "Benutzer nicht gefunden" };
    targetId = target.id;
  }

  const { raw, hash, prefix } = generateToken();
  await prisma.apiToken.create({
    data: { tenantId: user.tenantId, userId: targetId, name: r.data.name, tokenHash: hash, prefix },
  });
  await audit(user, "CREATE", "ApiToken", targetId, r.data.name);
  revalidatePath("/", "layout");
  return { ok: true, token: raw };
}

export async function revokeApiToken(fd: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(fd.get("id") ?? "");
  const tok = await prisma.apiToken.findFirst({ where: { id, tenantId: user.tenantId }, select: { id: true, userId: true } });
  if (!tok) return;
  // eigenes Token oder ADMIN
  if (tok.userId !== user.id && user.role !== "ADMIN") return;
  await prisma.apiToken.update({ where: { id: tok.id }, data: { revokedAt: new Date() } });
  await audit(user, "DELETE", "ApiToken", tok.id);
  revalidatePath("/", "layout");
}

// Endgültig entfernen (nur bereits widerrufene Token — aufräumen).
export async function deleteApiToken(fd: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(fd.get("id") ?? "");
  const tok = await prisma.apiToken.findFirst({ where: { id, tenantId: user.tenantId }, select: { id: true, userId: true, revokedAt: true } });
  if (!tok || !tok.revokedAt) return; // nur widerrufene löschen
  if (tok.userId !== user.id && user.role !== "ADMIN") return;
  await prisma.apiToken.delete({ where: { id: tok.id } });
  revalidatePath("/", "layout");
}
