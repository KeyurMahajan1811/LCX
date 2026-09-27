import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { AppShell } from "@/components/app-shell";
import { authOptions } from "@/lib/auth";

export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "VENDOR") redirect("/bank/mailbox");
  return (
    <AppShell
      variant="vendor"
      user={{
        id: session.user.id,
        name: session.user.name ?? "",
        email: session.user.email ?? "",
        role: session.user.role,
        bankId: session.user.bankId,
      }}
    >
      {children}
    </AppShell>
  );
}
