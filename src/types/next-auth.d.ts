import type { DefaultSession } from "next-auth";

type AppUserRole = "CLIENT" | "ASTROLOGER" | "ADMIN";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: AppUserRole;
    } & DefaultSession["user"];
  }

  interface User {
    role: AppUserRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: AppUserRole;
  }
}
