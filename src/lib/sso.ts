import { prisma } from "@/lib/prisma";

// Generisches OIDC/SSO (Authentik, Keycloak, …). Sicherheitsmodell: SSO meldet
// NUR bereits im System angelegte Benutzer an (Abgleich per E-Mail). Es gibt
// KEIN mandantenübergreifendes Auto-Provisioning — Rolle und Mandant kommen aus
// dem vorhandenen Benutzer. So bleibt die Mandantentrennung gewahrt.

export type OidcConfig = {
  id: "oidc";
  name: string;
  type: "oidc";
  issuer: string;
  clientId: string;
  clientSecret: string;
};

/** Liefert die OIDC-Provider-Konfiguration aus der Umgebung oder null (deaktiviert). */
export function oidcConfigFromEnv(env: NodeJS.ProcessEnv = process.env): OidcConfig | null {
  const issuer = env.OIDC_ISSUER?.trim();
  const clientId = env.OIDC_CLIENT_ID?.trim();
  const clientSecret = env.OIDC_CLIENT_SECRET?.trim();
  if (!issuer || !clientId || !clientSecret) return null;
  return {
    id: "oidc",
    name: env.OIDC_NAME?.trim() || "SSO",
    type: "oidc",
    issuer,
    clientId,
    clientSecret,
  };
}

export const isSsoEnabled = () => oidcConfigFromEnv() !== null;

/** Bestehenden Benutzer per E-Mail (case-insensitive) auflösen. */
export async function resolveSsoUser(email: string | null | undefined) {
  const e = email?.trim();
  if (!e) return null;
  return prisma.user.findFirst({
    where: { email: { equals: e, mode: "insensitive" } },
    select: { id: true, email: true, name: true, role: true, tenantId: true, locale: true },
  });
}
