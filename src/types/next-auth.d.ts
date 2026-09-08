import type { UserRole } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role: UserRole;
    tenantId: string;
    locale: string;
    superAdmin?: boolean;
  }
  interface Session {
    user: {
      id: string;
      role: UserRole;
      tenantId: string;
      locale: string;
      superAdmin: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: UserRole;
    tenantId: string;
    locale: string;
    superAdmin?: boolean;
  }
}
