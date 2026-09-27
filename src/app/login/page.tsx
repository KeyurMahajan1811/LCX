"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await signIn("credentials", { email, password, redirect: false });
    if (!result || result.error) {
      setError("Those credentials were not recognized.");
      setBusy(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#F7F6F4] px-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded bg-[#7A0C2E] text-xs font-semibold text-white">BoM</span>
          <div>
            <h1 className="text-xl font-semibold">LoanChallanX</h1>
            <p className="text-sm text-muted-foreground">Home loan settlement challans</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Demo bank: priya.kulkarni@mahabank.example · Demo vendor: sandeep@loanchallanx.example · Password LCX-demo-2026
        </p>
      </form>
    </main>
  );
}
