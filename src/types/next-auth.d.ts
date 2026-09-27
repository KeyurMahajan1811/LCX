import type { AppRole } from "@/lib/status";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      role: AppRole;
      bankId: string | null;
    };
  }

  interface User {
    role: AppRole;
    bankId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: AppRole;
    bankId?: string | null;
  }
}
