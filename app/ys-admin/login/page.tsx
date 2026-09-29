"use client";

import { useState } from "react";
import { useLogin } from "@refinedev/core";
import { Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function AdminLoginPage() {
  const { mutate: login, isPending, isError } = useLogin<{ email: string; password: string }>();
  // Dev convenience: prefilled so you can sign in with one click.
  const [email, setEmail] = useState("admin@ys.local");
  const [password, setPassword] = useState("admin123");

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 bg-[radial-gradient(ellipse_at_top,rgba(230,46,27,0.15),transparent_60%)] p-4">
      <Card className="w-full max-w-sm space-y-5 p-7">
        <div className="space-y-1.5 text-center">
          <span className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-ali-red/10">
            <ShieldCheck className="size-6 text-ali-red" />
          </span>
          <p className="text-2xl font-black tracking-tight"><span className="text-ali-red">ys</span>-admin</p>
          <p className="text-sm text-neutral-500">Marketplace console — admins only.</p>
        </div>
        {isError ? (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-center text-sm font-medium text-red-600">
            Invalid email or password.
          </p>
        ) : null}
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            login({ email, password });
          }}
        >
          <div className="relative">
            <Mail className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <Input
              type="email"
              placeholder="admin@ys.local"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <Input
              type="password"
              placeholder="Password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            type="submit"
            disabled={isPending}
            className="w-full bg-ali-red text-white hover:bg-ali-red-dark"
          >
            {isPending ? (<><Loader2 className="size-4 animate-spin" /> Signing in…</>) : "Sign in"}
          </Button>
        </form>
        <p className="text-center text-xs text-neutral-400">Dev seed: admin@ys.local / admin123</p>
      </Card>
    </div>
  );
}
