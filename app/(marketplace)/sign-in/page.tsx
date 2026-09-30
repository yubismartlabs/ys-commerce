"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { Loader2, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { safeNextPath } from "@/lib/auth/next-path";

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { status } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(params.get("error") ? "Please sign in to continue." : null);
  const [busy, setBusy] = useState(false);
  const next = safeNextPath(params.get("next"));

  if (status === "authenticated") {
    router.replace(next);
    return null;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await signIn("credentials", { email, password, redirect: false });
    setBusy(false);
    if (res?.ok) {
      router.push(next);
      router.refresh();
    } else if ((res as { code?: string } | undefined)?.code === "SUSPENDED") {
      setError("This account is suspended. Contact support.");
    } else {
      setError("Invalid email or password.");
    }
  };

  return (
    <Card className="w-full max-w-sm space-y-5 p-7">
      <div className="space-y-1 text-center">
        <p className="text-2xl font-black tracking-tight"><span className="text-ali-red">ys</span>-commerce</p>
        <p className="text-sm text-neutral-500">Welcome back — sign in to shop and sell.</p>
      </div>
      {error ? (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-center text-sm font-medium text-red-600">{error}</p>
      ) : null}
      <form className="space-y-3" onSubmit={submit}>
        <div className="relative">
          <Mail className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <Input type="email" placeholder="Email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9" />
        </div>
        <div className="relative">
          <Lock className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <Input type="password" placeholder="Password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="pl-9" />
        </div>
        <Button type="submit" disabled={busy} className="w-full bg-ali-red text-white hover:bg-ali-red-dark">
          {busy ? (<><Loader2 className="size-4 animate-spin" /> Signing in…</>) : "Sign in"}
        </Button>
      </form>
      <p className="text-center text-sm text-neutral-500">
        New to ys-commerce? <Link href="/sign-up" className="font-semibold text-ali-red hover:underline">Create an account</Link>
      </p>
    </Card>
  );
}

export default function SignInPage() {
  return (
    <div className="mx-auto flex max-w-7xl justify-center py-10">
      <Suspense>
        <SignInForm />
      </Suspense>
    </div>
  );
}
