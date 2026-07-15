import type { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

/** ADMIN darf alles; sonst muss die Rolle in `allowed` sein. */
export function roleAllows(role: UserRole, allowed: UserRole[]): boolean {
  return role === "ADMIN" || allowed.includes(role);
}

export type SessionUser = {
  id: string;
  tenantId: string;
  role: UserRole;
  name?: string | null;
  email?: string | null;
};

/** Server-Guard: liefert den User oder leitet zum Login. */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const u = session.user;
  return { id: u.id, tenantId: u.tenantId, role: u.role, name: u.name, email: u.email };
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
