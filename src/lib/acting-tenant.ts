import { cookies } from "next/headers";

// Super-Admins können in einen anderen Mandanten „wechseln". Der gewählte
// Mandant liegt in einem httpOnly-Cookie und wird NUR für Super-Admins beachtet
// (sonst immer der eigene Mandant). So folgt der gesamte mandanten-gescopte
// Code automatisch dem gewählten Mandanten.
export const ACTING_TENANT_COOKIE = "havewa_acting_tenant";

export async function actingTenantId(user: { tenantId: string; superAdmin?: boolean }): Promise<string> {
  if (!user.superAdmin) return user.tenantId;
  try {
    const v = (await cookies()).get(ACTING_TENANT_COOKIE)?.value;
    return v && v.trim() ? v : user.tenantId;
  } catch {
    return user.tenantId;
  }
}
