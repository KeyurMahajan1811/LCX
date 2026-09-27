"use client";

import { FilePlus2, Inbox, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { SessionUser } from "@/lib/session";
import { cn } from "cn";

export function AppShell({
  variant,
  user,
  children,
}: {
  variant: "bank" | "vendor";
  user: SessionUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const links =
    variant === "bank"
      ? [
          { href: "/bank/requests/new", label: "Submit New Request", icon: FilePlus2 },
          { href: "/bank/mailbox", label: "Mailbox", icon: Inbox },
        ]
      : [{ href: "/vendor/mailbox", label: "Mailbox", icon: Inbox }];

  return (
    <div data-theme={variant} className="min-h-screen bg-background text-foreground">
      <header
        className={cn(
          "flex h-14 items-center gap-3 px-4 text-white",
          variant === "bank" ? "bg-[#7A0C2E]" : "bg-[#1C2430]",
        )}
      >
        <span className="grid size-8 place-items-center rounded bg-white/10 text-[10px] font-semibold tracking-wide">
          {variant === "bank" ? "BoM" : "LCX"}
        </span>
        <div className="leading-tight">
          <div className="text-sm font-semibold">LoanChallanX</div>
          <div className="text-[11px] text-white/70">
            {variant === "bank" ? "Bank of Maharashtra" : "Vendor desk"}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <div className="text-right leading-tight">
            <div>{user.name}</div>
            <div className="text-[11px] text-[#D9A441]">{variant === "bank" ? "Bank official" : "Vendor"}</div>
          </div>
          <Button variant="outline" size="sm" className="border-white/30 bg-transparent text-white hover:bg-white/10" onClick={() => signOut({ callbackUrl: "/login" })}>
            <LogOut className="size-3.5" />
            Sign out
          </Button>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 md:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="h-fit rounded-xl border border-border bg-card p-2 shadow-sm">
          {links.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-600",
                  active && "bg-[#F8EFE6] font-medium text-[#7A0C2E]",
                  variant === "vendor" && active && "bg-[#F8F1E3] text-[#1C2430]",
                )}
              >
                <Icon className="size-4" />
                {link.label}
              </Link>
            );
          })}
        </aside>
        <div>{children}</div>
      </div>
    </div>
  );
}
