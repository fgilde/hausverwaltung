import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { oidcConfigFromEnv, resolveSsoUser } from "@/lib/sso";

const providers: Provider[] = [
  Credentials({
    credentials: { email: {}, password: {} },
    authorize: async (creds) => {
      const email = String(creds?.email ?? "");
      const password = String(creds?.password ?? "");
      if (!email || !password) return null;
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return null;
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return null;
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        locale: user.locale,
      };
    },
  }),
];

// Optionales OIDC/SSO — nur wenn per Env konfiguriert.
const oidc = oidcConfigFromEnv();
if (oidc) providers.push(oidc as unknown as Provider);

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers,
  callbacks: {
    // SSO meldet nur bestehende Benutzer an (kein Auto-Provisioning).
    async signIn({ user, account }) {
      if (account?.provider === "oidc") {
        return !!(await resolveSsoUser(user?.email));
      }
      return true;
    },
    async jwt({ token, user, account }) {
      // Credentials: user trägt bereits Rolle/Mandant.
      if (user && account?.provider !== "oidc") {
        token.role = user.role;
        token.tenantId = user.tenantId;
        token.locale = user.locale;
      }
      // OIDC-Erstanmeldung: lokalen Benutzer per E-Mail auflösen und dessen
      // Identität (id/Rolle/Mandant) in den Token übernehmen.
      if (account?.provider === "oidc" && user?.email) {
        const local = await resolveSsoUser(user.email);
        if (local) {
          token.sub = local.id;
          token.role = local.role;
          token.tenantId = local.tenantId;
          token.locale = local.locale;
        }
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.role = token.role as UserRole;
        session.user.tenantId = token.tenantId as string;
        session.user.locale = token.locale as string;
      }
      return session;
    },
  },
});
