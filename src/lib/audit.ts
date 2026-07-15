import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/rbac";
import type { AuditAction } from "@prisma/client";

/**
 * Schreibt einen Audit-Log-Eintrag (GoBD-Nachvollziehbarkeit).
 * Bewusst „fire-and-forget"-tolerant: ein Fehler beim Logging darf die
 * eigentliche Aktion nicht scheitern lassen.
 */
export async function audit(
  user: SessionUser,
  action: AuditAction,
  entity: string,
  entityId?: string | null,
  summary?: string,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        userName: user.name ?? user.email ?? null,
        action,
        entity,
        entityId: entityId ?? null,
        summary: summary ?? null,
      },
    });
  } catch {
    // Logging-Fehler schlucken — Kernaktion hat Vorrang.
  }
}
