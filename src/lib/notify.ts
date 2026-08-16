import { prisma } from "@/lib/prisma";

type NotificationInput = { title: string; body?: string; link?: string };

/** Benachrichtigung an bestimmte Benutzer erzeugen. */
export async function notifyUsers(tenantId: string, userIds: string[], n: NotificationInput) {
  if (userIds.length === 0) return;
  await prisma.notification.createMany({
    data: userIds.map((userId) => ({ tenantId, userId, title: n.title, body: n.body ?? null, link: n.link ?? null })),
  });
}

/** Benachrichtigung an alle Verwalter-Rollen des Mandanten (ADMIN/VERWALTER/BUCHHALTUNG). */
export async function notifyManagers(tenantId: string, n: NotificationInput) {
  const managers = await prisma.user.findMany({
    where: { tenantId, role: { in: ["ADMIN", "VERWALTER", "BUCHHALTUNG"] } },
    select: { id: true },
  });
  await notifyUsers(tenantId, managers.map((m) => m.id), n);
}
