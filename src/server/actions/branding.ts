"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { saveFile, deleteFile } from "@/lib/storage";
import { brandingSchema, type ActionState } from "@/lib/schemas";

export async function updateBranding(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireRole([]); // nur ADMIN (leere Liste → roleAllows nur ADMIN)
  const r = brandingSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Ungültige Eingabe" };
  await prisma.tenant.update({
    where: { id: user.tenantId },
    data: { brandColor: r.data.brandColor || null },
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

const MAX_LOGO = 2 * 1024 * 1024; // 2 MB

export async function uploadLogo(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireRole([]);
  const file = fd.get("logo");
  if (!(file instanceof File) || file.size === 0) return { error: "Keine Datei" };
  if (file.size > MAX_LOGO) return { error: "Logo zu groß (max. 2 MB)" };
  if (!file.type.startsWith("image/")) return { error: "Nur Bilddateien" };

  const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { logoKey: true } });
  const buffer = Buffer.from(await file.arrayBuffer());
  const key = await saveFile(buffer, file.name);
  await prisma.tenant.update({ where: { id: user.tenantId }, data: { logoKey: key } });
  if (tenant?.logoKey) await deleteFile(tenant.logoKey);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeLogo(): Promise<void> {
  const user = await requireRole([]);
  const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { logoKey: true } });
  if (tenant?.logoKey) await deleteFile(tenant.logoKey);
  await prisma.tenant.update({ where: { id: user.tenantId }, data: { logoKey: null } });
  revalidatePath("/", "layout");
}
