"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/rbac";
import { saveFile, deleteFile } from "@/lib/storage";
import { isEInvoice, parseEInvoice } from "@/lib/adapters/erechnung";
import type { ActionState } from "@/lib/schemas";

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

export async function uploadDocument(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Keine Datei" };
  if (file.size > MAX_SIZE) return { error: "Datei zu groß (max. 20 MB)" };

  const category = String(fd.get("category") ?? "SONSTIGES");
  const name = String(fd.get("name") ?? "").trim() || file.name;
  const propertyIdRaw = String(fd.get("propertyId") ?? "");
  const propertyId = propertyIdRaw || null;

  if (propertyId) {
    const prop = await prisma.property.findFirst({ where: { id: propertyId, tenantId: user.tenantId }, select: { id: true } });
    if (!prop) return { error: "Objekt nicht gefunden" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const storageKey = await saveFile(buffer, file.name);
  const eInvoice = isEInvoice(file.type, file.name) || category === "ERECHNUNG";

  // E-Rechnung automatisch auslesen (nur XML-Syntaxen; PDF/A-3-Einbettung = Ceiling).
  const parsed = eInvoice ? parseEInvoice(buffer, file.type) : null;

  await prisma.document.create({
    data: {
      tenantId: user.tenantId,
      propertyId,
      name,
      category: category as never,
      mime: file.type || "application/octet-stream",
      size: file.size,
      storageKey,
      eInvoice,
      invoiceNo: parsed?.invoiceNumber ?? null,
      invoiceTotal: parsed?.total ?? null,
    },
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteDocument(fd: FormData): Promise<void> {
  const user = await requireWriter();
  const id = String(fd.get("id") ?? "");
  const doc = await prisma.document.findFirst({ where: { id, tenantId: user.tenantId } });
  if (doc) {
    await deleteFile(doc.storageKey);
    await prisma.document.delete({ where: { id: doc.id } });
  }
  revalidatePath("/", "layout");
}
