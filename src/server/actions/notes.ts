"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/rbac";
import { noteSchema, type ActionState } from "@/lib/schemas";
import { sanitizeMailHtml } from "@/server/mail-sanitize";

// Zentrale Notizen (#89). Text kommt als Editor-HTML und wird wie Mails bereinigt.
async function parseNote(fd: FormData, tenantId: string) {
  const r = noteSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Ungültige Eingabe" };
  const { propertyId, unitId, personId } = r.data;
  // Zuordnungen müssen zum Mandanten gehören
  if (propertyId && !(await prisma.property.findFirst({ where: { id: propertyId, tenantId }, select: { id: true } })))
    return { error: "Objekt nicht gefunden" };
  if (unitId && !(await prisma.unit.findFirst({ where: { id: unitId, tenantId }, select: { id: true } })))
    return { error: "Einheit nicht gefunden" };
  if (personId && !(await prisma.person.findFirst({ where: { id: personId, tenantId }, select: { id: true } })))
    return { error: "Person nicht gefunden" };
  return {
    data: {
      title: r.data.title,
      body: sanitizeMailHtml(r.data.body),
      pinned: r.data.pinned,
      propertyId: propertyId ?? null,
      unitId: unitId ?? null,
      personId: personId ?? null,
    },
  };
}

export async function createNote(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const r = await parseNote(fd, user.tenantId);
  if (!r.data) return { error: r.error };
  await prisma.note.create({ data: { ...r.data, tenantId: user.tenantId, author: user.name ?? null } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateNote(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const r = await parseNote(fd, user.tenantId);
  if (!r.data) return { error: r.error };
  const res = await prisma.note.updateMany({ where: { id: String(fd.get("id") ?? ""), tenantId: user.tenantId }, data: r.data });
  if (res.count === 0) return { error: "Notiz nicht gefunden" };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteNote(fd: FormData): Promise<void> {
  const user = await requireWriter();
  await prisma.note.deleteMany({ where: { id: String(fd.get("id") ?? ""), tenantId: user.tenantId } });
  revalidatePath("/", "layout");
}
