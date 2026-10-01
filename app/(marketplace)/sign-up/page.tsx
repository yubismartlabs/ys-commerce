"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { Loader2, Lock, Mail, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function SignUpPage() {
  const router = useRouter();
  const { status } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/");
    }
  }, [status, router]);

  if (status === "authenticated") {
    return null;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Sign up failed.");
      const login = await signIn("credentials", { email, password, redirect: false });
      if (!login?.ok) throw new Error("Account created — please sign in.");
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-7xl justify-center py-10">
      <Card className="w-full max-w-sm space-y-5 p-7">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-black tracking-tight"><span className="text-ali-red">ys</span>-commerce</h1>
          <p className="text-sm text-neutral-500">One account to buy and sell.</p>
        </div>
        {error ? (
          <p role="alert" aria-live="assertive" id="signup-error" className="rounded-lg bg-red-500/10 px-3 py-2 text-center text-sm font-medium text-red-600">
            {error}
          </p>
        ) : null}
        <form className="space-y-3" onSubmit={submit}>
          {/* Placeholders are not labels — every field gets a real one. */}
          <div className="relative">
            <label htmlFor="signup-name" className="sr-only">Full name</label>
            <User className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden />
            <Input id="signup-name" placeholder="Full name" autoComplete="name" required value={name} aria-invalid={!!error} aria-describedby={error ? "signup-error" : undefined} onChange={(e) => setName(e.target.value)} className="pl-9" />
          </div>
          <div className="relative">
            <label htmlFor="signup-email" className="sr-only">Email</label>
            <Mail className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden />
            <Input id="signup-email" type="email" placeholder="Email" autoComplete="email" required value={email} aria-invalid={!!error} aria-describedby={error ? "signup-error" : undefined} onChange={(e) => setEmail(e.target.value)} className="pl-9" />
          </div>
          <div className="relative">
            <label htmlFor="signup-password" className="sr-only">Password</label>
            <Lock className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden />
            <Input id="signup-password" type="password" placeholder="Password (8+ characters)" autoComplete="new-password" required minLength={8} value={password} aria-invalid={!!error} aria-describedby={error ? "signup-error" : undefined} onChange={(e) => setPassword(e.target.value)} className="pl-9" />
          </div>
          <div className="relative">
            <label htmlFor="signup-confirm" className="sr-only">Confirm password</label>
            <Lock className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden />
            <Input id="signup-confirm" type="password" placeholder="Confirm password" autoComplete="new-password" required value={confirm} aria-invalid={!!error} aria-describedby={error ? "signup-error" : undefined} onChange={(e) => setConfirm(e.target.value)} className="pl-9" />
          </div>
          <Button type="submit" disabled={busy} className="w-full bg-ali-red text-white hover:bg-ali-red-dark">
            {busy ? (<><Loader2 className="size-4 animate-spin" /> Creating account…</>) : "Create account"}
          </Button>
        </form>
        <p className="text-center text-sm text-neutral-500">
          Already have an account? <Link href="/sign-in" className="font-semibold text-ali-red hover:underline">Sign in</Link>
        </p>
      </Card>
    </div>
  );
}
