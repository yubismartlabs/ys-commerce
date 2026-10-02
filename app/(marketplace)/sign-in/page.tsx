"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";
import { Loader2, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { safeNextPath } from "@/lib/auth/next-path";
import { useHydrated } from "@/lib/hooks/use-hydrated";

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { status } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(params.get("error") ? "Please sign in to continue." : null);
  const [busy, setBusy] = useState(false);
  const next = safeNextPath(params.get("next"));
  // Set by the account layout when the session cookie points at a user who no
  // longer exists. next-auth still reports that cookie as authenticated, so the
  // normal "already signed in, skip past the form" path would fire and bounce
  // the visitor straight back into the account area in a redirect loop. Drop the
  // cookie instead, so the form they actually need to use is reachable.
  const staleSession = params.get("reason") === "session";
  const hydrated = useHydrated();

  useEffect(() => {
    if (status !== "authenticated") return;
    if (staleSession) {
      void signOut({ redirect: false });
      return;
    }
    router.replace(next);
  }, [status, next, router, staleSession]);

  if (status === "authenticated" && !staleSession) {
    return null;
  }

  // The email/password fields are controlled, so React only starts honouring
  // them after hydration. Rendering them before then means anything typed in
  // that window — by a fast typist, or by an automated client — is silently
  // discarded, and submitting submits empty credentials. Hold the form back
  // until the component is live.
  if (!hydrated) {
    return (
      <Card className="w-full max-w-sm space-y-5 p-7" aria-busy="true">
        <div className="h-8 w-40 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800" />
        <div className="h-10 w-full animate-pulse rounded bg-neutral-100 dark:bg-neutral-800" />
        <div className="h-10 w-full animate-pulse rounded bg-neutral-100 dark:bg-neutral-800" />
        <div className="h-10 w-full animate-pulse rounded bg-neutral-100 dark:bg-neutral-800" />
      </Card>
    );
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
        <h1 className="text-2xl font-black tracking-tight">
          <span className="text-ali-red">ys</span>-commerce
        </h1>
        <p className="text-sm text-neutral-500">Welcome back — sign in to shop and sell.</p>
      </div>
      {/* role=alert so a screen reader announces the failure, not just shows it. */}
      {error ? (
        <p role="alert" aria-live="assertive" id="signin-error" className="rounded-lg bg-red-500/10 px-3 py-2 text-center text-sm font-medium text-red-600">
          {error}
        </p>
      ) : null}
      {/* Informational, not an error: the cookie was dropped because the
          account behind it is gone, which is expected on a reset dev database
          and alarming anywhere else. Say which, rather than a bare form. */}
      {staleSession && !error ? (
        <p aria-live="polite" className="rounded-lg bg-neutral-100 px-3 py-2 text-center text-sm text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
          {hydrated && status !== "authenticated"
            ? "Your previous session is no longer valid — sign in again."
            : "Signing you out…"}
        </p>
      ) : null}
      <form className="space-y-3" onSubmit={submit}>
        <div className="relative">
          {/* A placeholder is not a label: it vanishes on focus and is skipped
              by several screen readers. */}
          <label htmlFor="signin-email" className="sr-only">Email</label>
          <Mail className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden />
          <Input
            id="signin-email"
            type="email"
            placeholder="Email"
            autoComplete="email"
            required
            value={email}
            aria-invalid={!!error}
            aria-describedby={error ? "signin-error" : undefined}
            onChange={(e) => setEmail(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="relative">
          <label htmlFor="signin-password" className="sr-only">Password</label>
          <Lock className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden />
          <Input
            id="signin-password"
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            required
            value={password}
            aria-invalid={!!error}
            aria-describedby={error ? "signin-error" : undefined}
            onChange={(e) => setPassword(e.target.value)}
            className="pl-9"
          />
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
