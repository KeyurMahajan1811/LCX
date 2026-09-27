"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { readCredentials } from "@/lib/credentials";
import { cn } from "cn";

const links = [
  { href: "/", label: "Markets" },
  { href: "/portfolio", label: "Portfolio" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [live, setLive] = useState(false);

  useEffect(() => {
    const sync = () => setLive(Boolean(readCredentials()));
    sync();
    window.addEventListener("lcx-credentials", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("lcx-credentials", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
              LX
            </span>
            <span className="text-sm font-semibold tracking-tight">LCX Desk</span>
          </Link>
          <nav className="flex items-center gap-1">
            {links.map((link) => {
              const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-sm text-muted-foreground hover:text-foreground",
                    active && "bg-muted text-foreground",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <span className={cn("rounded-full px-2 py-0.5", live ? "bg-up/15 text-up" : "bg-muted")}>
              {live ? "Live keys saved" : "Paper book"}
            </span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-5">{children}</main>
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-border bg-card", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function StatusLine({
  loading,
  error,
  empty,
  children,
}: {
  loading?: boolean;
  error?: string | null;
  empty?: string | null;
  children: React.ReactNode;
}) {
  if (loading) {
    return <p className="px-3 py-8 text-center text-sm text-muted-foreground">Loading LCX market data…</p>;
  }
  if (error) {
    return <p className="px-3 py-8 text-center text-sm text-down">{error}</p>;
  }
  if (empty) {
    return <p className="px-3 py-8 text-center text-sm text-muted-foreground">{empty}</p>;
  }
  return children;
}
