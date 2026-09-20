"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";

export async function markNotificationRead(fd: FormData): Promise<void> {
  const user = await requireUser();
  await prisma.notification.updateMany({
    where: { id: String(fd.get("id") ?? ""), userId: user.id },
    data: { read: true },
  });
  revalidatePath("/", "layout");
}

export async function markAllNotificationsRead(): Promise<void> {
  const user = await requireUser();
  await prisma.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
  revalidatePath("/", "layout");
}

// Einzelne Benachrichtigung entfernen (z. B. Meldung zu gelöschtem Ticket).
export async function deleteNotification(fd: FormData): Promise<void> {
  const user = await requireUser();
  await prisma.notification.deleteMany({ where: { id: String(fd.get("id") ?? ""), userId: user.id } });
  revalidatePath("/", "layout");
}
