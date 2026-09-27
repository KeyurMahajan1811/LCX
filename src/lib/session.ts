import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { AppRole } from "@/lib/status";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  bankId: string | null;
};

export async function currentUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.role) return null;
  return {
    id: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    role: session.user.role,
    bankId: session.user.bankId ?? null,
  };
}
