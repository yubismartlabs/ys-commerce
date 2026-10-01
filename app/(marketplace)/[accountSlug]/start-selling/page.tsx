"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Check, Loader2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { normalizeUsername } from "@/lib/usernames";
import { useAccountBase } from "@/lib/account-url";

type Availability =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "ok"; value: string }
  | { state: "error"; message: string };

export default function StartSellingPage() {
  const [store, setStore] = useState("My Awesome Store");
  const [username, setUsername] = useState("");
  const [avail, setAvail] = useState<Availability>({ state: "idle" });
  // Public store @handle (your /store/@username URL). Chosen once here;
  // renames later are capped for life.
  const [storeUsername, setStoreUsername] = useState("");
  const [storeAvail, setStoreAvail] = useState<Availability>({ state: "idle" });
  const [busy, setBusy] = useState(false);
  const { data: session, status, update } = useSession();
  const currentHandle = (session?.user as { username?: string | null } | undefined)?.username;
  const router = useRouter();
  const base = useAccountBase();

  // Anyone can sell: if this account already owns a store, send it to the
  // store page instead of showing the creation form again.
  useEffect(() => {
    if (status !== "loading") {
      fetch("/api/v1/account/selling/store")
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          const stores = Array.isArray(j?.data) ? j.data : j?.data ? [j.data] : [];
          if (stores.length > 0) router.replace(`${base}/store`);
        })
        .catch(() => {});
    }
  }, [status, router, base]);

  // Live availability check (debounced) for the custom handle. The "checking"
  // state is set in the change handler below so the effect body never calls
  // setState synchronously (react-hooks/set-state-in-effect).
  useEffect(() => {
    const v = normalizeUsername(username);
    if (!v) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/account/username/availability?username=${encodeURIComponent(v)}`);
        const json = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !json?.data) throw new Error("Check failed.");
        if (json.data.available) setAvail({ state: "ok", value: json.data.value });
        else setAvail({ state: "error", message: json.data.message ?? "Not available." });
      } catch {
        if (!cancelled) setAvail({ state: "error", message: "Couldn't check availability." });
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [username]);

  const onUsernameChange = (v: string) => {
    setUsername(v);
    // Keep the hint in sync without waiting for the debounced fetch.
    if (!normalizeUsername(v)) setAvail({ state: "idle" });
    else setAvail({ state: "checking" });
  };

  // Same live check for the store @handle — the shared namespace means one
  // endpoint covers both fields.
  useEffect(() => {
    const v = normalizeUsername(storeUsername);
    if (!v) {
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/account/username/availability?username=${encodeURIComponent(v)}`);
        const json = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !json?.data) throw new Error("Check failed.");
        if (json.data.available) setStoreAvail({ state: "ok", value: json.data.value });
        else setStoreAvail({ state: "error", message: json.data.message ?? "Not available." });
      } catch {
        if (!cancelled) setStoreAvail({ state: "error", message: "Couldn't check availability." });
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [storeUsername]);

  const onStoreUsernameChange = (v: string) => {
    setStoreUsername(v);
    if (!normalizeUsername(v)) setStoreAvail({ state: "idle" });
    else setStoreAvail({ state: "checking" });
  };

  if (status === "loading") {
    return <Card className="mx-auto max-w-xl p-6 text-sm text-neutral-500">Loading…</Card>;
  }

  if (status === "unauthenticated") {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <h1 className="text-xl font-bold">Start selling on ys-commerce</h1>
        <Card className="space-y-3 p-6 text-center">
          <p className="text-sm text-neutral-500">Sign in first — one account buys and sells — no separate seller account needed.</p>
          <Button asChild className="bg-ali-red text-white hover:bg-ali-red-dark">
            <Link href="/sign-in?next=/account/start-selling">Sign in to continue</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const usernameTaken = avail.state === "error";
  const storeUsernameTaken = storeAvail.state === "error";
  const canSubmit =
    !busy &&
    store.trim().length >= 2 &&
    !usernameTaken &&
    avail.state !== "checking" &&
    !storeUsernameTaken &&
    storeAvail.state !== "checking";

  const open = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/v1/auth/become-seller", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeName: store.trim(),
          ...(normalizeUsername(username) ? { username: normalizeUsername(username) } : {}),
          ...(normalizeUsername(storeUsername) ? { storeUsername: normalizeUsername(storeUsername) } : {}),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Could not open your store.");
      await update();
      const handle = json?.data?.username ?? currentHandle;
      toast.success(`Welcome${handle ? `, @${handle}` : ""}! Your store is live — list your first item.`);
      router.push(`${base}/store`);
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
      <Card className="space-y-4 p-4">
        <p className="text-sm text-neutral-500">
          One account for buying + selling. Anyone can list — your store opens <strong>instantly</strong> and
          your items go live as soon as you publish them.
          {currentHandle ? (
            <> Your handle is <Link href={`/u/${currentHandle}`} className="font-mono font-semibold text-ali-red hover:underline">@{currentHandle}</Link>.</>
          ) : null}
        </p>
        <div className="grid gap-1.5">
          <label htmlFor="store-name" className="text-sm font-medium">Store name</label>
          <Input id="store-name" value={store} onChange={(e) => setStore(e.target.value)} placeholder="Store name" maxLength={80} />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="store-username" className="text-sm font-medium">
            Store username
          </label>
          <Input
            id="store-username"
            value={storeUsername}
            onChange={(e) => onStoreUsernameChange(e.target.value)}
            placeholder="e.g. acme.collects"
            maxLength={30}
            autoComplete="off"
            spellCheck={false}
            aria-describedby="store-username-hint"
            className="font-mono"
          />
          <div id="store-username-hint" className="min-h-5 text-xs" aria-live="polite">
            {!normalizeUsername(storeUsername) ? (
              <span className="text-neutral-500">Your public URL will be <span className="font-mono">/store/@you-pick</span>. Leave blank to derive it from the store name. Renames later are limited.</span>
            ) : storeAvail.state === "checking" ? (
              <span className="inline-flex items-center gap-1 text-neutral-500"><Loader2 className="size-3.5 animate-spin" /> Checking…</span>
            ) : storeAvail.state === "ok" ? (
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-600"><Check className="size-3.5" /> /store/@{storeAvail.value} is available</span>
            ) : storeAvail.state === "error" ? (
              <span className="inline-flex items-center gap-1 font-medium text-red-600"><X className="size-3.5" /> {storeAvail.message}</span>
            ) : (
              <span className="text-neutral-500">Your public URL will be <span className="font-mono">/store/@you-pick</span>.</span>
            )}
          </div>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="seller-username" className="text-sm font-medium">
            Username <span className="font-normal text-neutral-500">(optional — claim a custom handle while opening your store)</span>
          </label>
          <Input
            id="seller-username"
            value={username}
            onChange={(e) => onUsernameChange(e.target.value)}
            placeholder={currentHandle ?? "e.g. ada.collects"}
            maxLength={30}
            autoComplete="off"
            spellCheck={false}
            aria-describedby="seller-username-hint"
            className="font-mono"
          />
          <div id="seller-username-hint" className="min-h-5 text-xs" aria-live="polite">
            {!normalizeUsername(username) ? (
              <span className="text-neutral-500">Leave blank to keep your auto-generated handle. 3–30 lowercase letters/numbers with . _ -</span>
            ) : avail.state === "checking" ? (
              <span className="inline-flex items-center gap-1 text-neutral-500"><Loader2 className="size-3.5 animate-spin" /> Checking…</span>
            ) : avail.state === "ok" ? (
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-600"><Check className="size-3.5" /> @{avail.value} is available</span>
            ) : avail.state === "error" ? (
              <span className="inline-flex items-center gap-1 font-medium text-red-600"><X className="size-3.5" /> {avail.message}</span>
            ) : (
              <span className="text-neutral-500">Leave blank to keep your auto-generated handle.</span>
            )}
          </div>
        </div>
        <Button className="w-full bg-ali-red text-white hover:bg-ali-red-dark" disabled={!canSubmit} onClick={open}>
          {busy ? (<><Loader2 className="size-4 animate-spin" /> Opening…</>) : "Open my store"}
        </Button>
      </Card>
    </div>
  );
}
