"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { sendMail, isMailerConfigured } from "@/lib/adapters/mailer";
import { emailSchema, type ActionState } from "@/lib/schemas";

export async function createEmail(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const r = emailSchema.safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Ungültige Eingabe" };
  const msg = await prisma.emailMessage.create({
    data: { ...r.data, tenantId: user.tenantId, status: "ENTWURF" },
  });
  await audit(user, "CREATE", "EmailMessage", msg.id, r.data.subject);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function sendEmail(fd: FormData): Promise<void> {
  const user = await requireWriter();
  const id = String(fd.get("id") ?? "");
  const msg = await prisma.emailMessage.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!msg) return;

  try {
    await sendMail({ to: msg.toAddress, subject: msg.subject, body: msg.body });
    await prisma.emailMessage.update({
      where: { id: msg.id },
      data: { status: "GESENDET", sentAt: new Date(), error: null },
    });
    await audit(
      user,
      "UPDATE",
      "EmailMessage",
      msg.id,
      isMailerConfigured() ? "gesendet" : "in Postausgang gestellt (kein SMTP)",
    );
  } catch (e) {
    await prisma.emailMessage.update({
      where: { id: msg.id },
      data: { status: "FEHLER", error: e instanceof Error ? e.message : "Versand fehlgeschlagen" },
    });
  }
  revalidatePath("/", "layout");
}

export async function deleteEmail(fd: FormData): Promise<void> {
  const user = await requireWriter();
  const id = String(fd.get("id") ?? "");
  const res = await prisma.emailMessage.deleteMany({ where: { id, tenantId: user.tenantId } });
  if (res.count > 0) await audit(user, "DELETE", "EmailMessage", id);
  revalidatePath("/", "layout");
}
