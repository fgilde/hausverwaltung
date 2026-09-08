import type { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { actingTenantId } from "@/lib/acting-tenant";

/** ADMIN darf alles; sonst muss die Rolle in `allowed` sein. */
export function roleAllows(role: UserRole, allowed: UserRole[]): boolean {
  return role === "ADMIN" || allowed.includes(role);
}

export type SessionUser = {
  id: string;
  tenantId: string; // effektiver Mandant (bei Super-Admin ggf. der gewechselte)
  homeTenantId: string; // eigener Mandant
  superAdmin: boolean;
  role: UserRole;
  name?: string | null;
  email?: string | null;
};

/** Server-Guard: liefert den User oder leitet zum Login. */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const u = session.user;
  const tenantId = await actingTenantId(u);
  return {
    id: u.id,
    tenantId,
    homeTenantId: u.tenantId,
    superAdmin: !!u.superAdmin,
    role: u.role,
    name: u.name,
    email: u.email,
  };
}

/** Guard: nur Instanz-Admins (Mandantenverwaltung). */
export async function requireSuperAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.superAdmin) redirect("/");
  return user;
}

/** Wie requireUser, erzwingt zusätzlich eine der erlaubten Rollen. */
export async function requireRole(allowed: UserRole[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roleAllows(user.role, allowed)) redirect("/");
  return user;
}

/** Rollen mit Schreibrecht auf Stammdaten. ADMIN ist über roleAllows immer dabei. */
export const WRITE_ROLES: UserRole[] = ["VERWALTER", "BUCHHALTUNG"];

/** Guard für Server Actions: liefert schreibberechtigten User. */
export function requireWriter() {
  return requireRole(WRITE_ROLES);
}

// ---------- Benutzerverwaltung ----------

const ALL_ROLES: UserRole[] = [
  "ADMIN", "VERWALTER", "BUCHHALTUNG", "BEIRAT", "EIGENTUEMER", "MIETER", "HANDWERKER",
];

/**
 * Welche Rollen darf ein Benutzer anderen zuweisen (anlegen)?
 * - ADMIN: alle.
 * - VERWALTER: Fach- und Portal-Rollen, aber keine ADMIN/VERWALTER (nur Admins
 *   dürfen weitere Admins/Verwalter erstellen).
 * - sonst: keine.
 */
export function assignableRoles(role: UserRole): UserRole[] {
  if (role === "ADMIN") return ALL_ROLES;
  if (role === "VERWALTER") return ["BUCHHALTUNG", "BEIRAT", "EIGENTUEMER", "MIETER", "HANDWERKER"];
  return [];
}

/** Darf `actor` einen Benutzer mit Rolle `targetRole` (id `targetId`) löschen? */
export function canDeleteUser(actor: SessionUser, targetRole: UserRole, targetId: string): boolean {
  if (actor.id === targetId) return false; // kein Selbst-Löschen
  return assignableRoles(actor.role).includes(targetRole);
}
