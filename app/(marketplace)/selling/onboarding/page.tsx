"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function SellingOnboardingPage() {
  const [store, setStore] = useState("My Awesome Store");
  const [busy, setBusy] = useState(false);
  const { data: session, status, update } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const router = useRouter();

  if (status === "loading") {
    return <Card className="mx-auto max-w-xl p-6 text-sm text-neutral-500">Loading…</Card>;
  }

  if (status === "unauthenticated") {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <h1 className="text-xl font-bold">Start selling on ys-commerce</h1>
        <Card className="space-y-3 p-6 text-center">
          <p className="text-sm text-neutral-500">Sign in first — your buyer account becomes your seller account.</p>
          <Button asChild className="bg-ali-red text-white hover:bg-ali-red-dark">
            <Link href="/sign-in?next=/selling/onboarding">Sign in to continue</Link>
          </Button>
        </Card>
      </div>
    );
  }

  if (role === "SELLER" || role === "ADMIN") {
    router.replace("/selling/dashboard");
    return null;
  }

  const open = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/v1/auth/become-seller", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeName: store }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Could not open your store.");
      await update();
      toast.success(`Welcome, ${store}! Your store is pending approval.`);
      router.push("/selling/dashboard");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open your store.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-xl font-bold">Start selling on ys-commerce</h1>
      <Card className="space-y-3 p-4">
        <p className="text-sm text-neutral-500">
          One account for buying + selling. Your store opens in <strong>pending</strong> status until an admin approves it.
        </p>
        <Input value={store} onChange={(e) => setStore(e.target.value)} placeholder="Store name" maxLength={80} />
        <Button className="w-full bg-ali-red text-white hover:bg-ali-red-dark" disabled={busy || store.trim().length < 2} onClick={open}>
          {busy ? (<><Loader2 className="size-4 animate-spin" /> Opening…</>) : "Open my store"}
        </Button>
      </Card>
    </div>
  );
}
