"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { storeUrl } from "@/lib/stores/url";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAccountBase } from "@/lib/account-url";

type Store = {
  id: string;
  name: string;
  slug: string;
  username: string | null;
  usernameChangeCount: number;
  usernameChangesRemaining?: number;
  description: string | null;
  logo: string | null;
  banner: string | null;
  shippingPolicy: string | null;
  returnPolicy: string | null;
  announcement: string | null;
  status: string;
  ratingAvg: number;
  followerCount: number;
};

export default function StoreSettingsPage() {
  const base = useAccountBase();
  const queryClient = useQueryClient();
  const [storeId, setStoreId] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string> | null>(null);

  const query = useQuery({
    queryKey: ["account-store", storeId || "all"],
    queryFn: async (): Promise<{ stores: Store[]; current: Store | null }> => {
      const q = storeId ? `?id=${storeId}` : "";
      const res = await fetch(`/api/v1/account/selling/store${q}`);
      if (res.status === 401) throw new Error("Sign in to manage your store.");
      if (!res.ok) throw new Error("Couldn't load store.");
      const json = await res.json();
      const stores = (Array.isArray(json.data) ? json.data : [json.data]) as Store[];
      return { stores, current: storeId ? stores[0] ?? null : (stores[0] ?? null) };
    },
    retry: false,
  });

  const stores = query.data?.stores ?? [];
  const current = query.data?.current ?? null;
  const activeId = storeId || current?.id || "";
  const f = form ?? {
    name: current?.name ?? "",
    username: current?.username ?? "",
    description: current?.description ?? "",
    logo: current?.logo ?? "",
    banner: current?.banner ?? "",
    shippingPolicy: current?.shippingPolicy ?? "",
    returnPolicy: current?.returnPolicy ?? "",
    announcement: current?.announcement ?? "",
  };
  const set = (k: string, v: string) => setForm({ ...f, [k]: v });
  // Remaining lifetime renames. The server is authoritative (it also knows
  // the admin-tuned cap); this is just the optimistic hint.
  const [remaining, setRemaining] = useState<number | null>(null);
  const changesRemaining = remaining ?? current?.usernameChangesRemaining ?? null;
  const usernameChanged =
    f.username.trim().toLowerCase() !== (current?.username ?? "").toLowerCase();

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current) return;
    if (f.name.trim().length < 2) {
      toast.error("Store name needs 2+ characters.");
      return;
    }
    if (f.username.trim() && !/^[a-z0-9](?:[a-z0-9._-]{1,28}[a-z0-9])$/.test(f.username.trim().toLowerCase())) {
      toast.error("Store username: 3–30 lowercase letters/numbers with . _ -");
      return;
    }
    if (usernameChanged && changesRemaining === 0) {
      toast.error("You've used all your store username changes.");
      return;
    }
    if (
      usernameChanged &&
      !window.confirm(
        `Your public URL moves to /store/@${f.username.trim().toLowerCase()} and old @ links stop working. Continue?`
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      // Always target the store being edited. Omitting `?id=` makes the API
      // fall back to the seller's OLDEST store, which silently wrote store B's
      // profile onto store A whenever a multi-store seller used the switcher.
      const res = await fetch(`/api/v1/account/selling/store?id=${encodeURIComponent(current.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: f.name.trim(),
          ...(usernameChanged ? { username: f.username.trim().toLowerCase() } : {}),
          description: f.description.trim() || null,
          logo: f.logo.trim() || null,
          banner: f.banner.trim() || null,
          shippingPolicy: f.shippingPolicy.trim() || null,
          returnPolicy: f.returnPolicy.trim() || null,
          announcement: f.announcement.trim() || null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Save failed.");
      if (typeof json?.data?.usernameChangesRemaining === "number") {
        setRemaining(json.data.usernameChangesRemaining);
      }
      toast.success("Store profile updated.");
      setForm(null);
      queryClient.invalidateQueries({ queryKey: ["account-store"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  if (query.isLoading) return <Card className="p-6 text-sm text-neutral-500">Loading store…</Card>;
  if (query.isError) {
    return (
      <Card className="space-y-2 p-6 text-sm text-neutral-500">
        <p>{query.error.message}</p>
        <Button size="sm" variant="outline" asChild><Link href={`${base}/start-selling`}>Open a store</Link></Button>
      </Card>
    );
  }
  if (!current) {
    return (
      <Card className="space-y-2 p-6 text-sm text-neutral-500">
        <p>No stores yet.</p>
        <Button size="sm" variant="outline" asChild><Link href={`${base}/start-selling`}>Open a store</Link></Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Store settings</h1>
        <div className="flex items-center gap-2">
          {stores.length > 1 ? (
            <Select value={activeId} onValueChange={(v) => { setStoreId(v); setForm(null); setRemaining(null); }}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Button size="sm" variant="outline" asChild>
            <Link href={storeUrl({ slug: current.slug, username: current.username })} target="_blank">View storefront</Link>
          </Button>
        </div>
      </div>
      <p className="text-sm text-neutral-500">
        ★ {current.ratingAvg.toFixed(1)} · {current.followerCount.toLocaleString()} followers · status {current.status}
      </p>
      <form onSubmit={save}>
        <Card className="grid gap-3 p-5">
          <div className="grid gap-1">
            <label htmlFor="st-name" className="text-sm font-medium">Store name</label>
            <Input id="st-name" value={f.name} onChange={(e) => set("name", e.target.value)} maxLength={80} />
          </div>
          <div className="grid gap-1">
            <label htmlFor="st-username" className="text-sm font-medium">Store username</label>
            <Input
              id="st-username"
              value={f.username}
              onChange={(e) => set("username", e.target.value)}
              maxLength={30}
              spellCheck={false}
              className="font-mono"
              placeholder="your-handle"
              disabled={changesRemaining === 0}
            />
            <p className="text-xs text-neutral-500">
              Your page: <span className="font-mono">/store/@{f.username.trim().toLowerCase() || current.username || current.slug}</span>
              {changesRemaining !== null ? (
                <> · <span className={changesRemaining === 0 ? "font-semibold text-red-600" : undefined}>
                  {changesRemaining === 0
                    ? "no username changes left"
                    : `${changesRemaining} username ${changesRemaining === 1 ? "change" : "changes"} left (lifetime)`}
                </span></>
              ) : null}
            </p>
          </div>
          <div className="grid gap-1">
            <label htmlFor="st-description" className="text-sm font-medium">Description</label>
            <Textarea id="st-description" value={f.description} onChange={(e) => set("description", e.target.value)} rows={3} maxLength={2000} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-1">
              <label htmlFor="st-logo" className="text-sm font-medium">Logo URL</label>
              <Input id="st-logo" value={f.logo} onChange={(e) => set("logo", e.target.value)} placeholder="https://…" />
            </div>
            <div className="grid gap-1">
              <label htmlFor="st-banner" className="text-sm font-medium">Banner URL</label>
              <Input id="st-banner" value={f.banner} onChange={(e) => set("banner", e.target.value)} placeholder="https://…" />
            </div>
          </div>
          <div className="grid gap-1">
            <label htmlFor="st-announcement" className="text-sm font-medium">Announcement <span className="font-normal text-neutral-400">(banner strip on your store page)</span></label>
            <Input id="st-announcement" value={f.announcement} onChange={(e) => set("announcement", e.target.value)} maxLength={300} />
          </div>
          <div className="grid gap-1">
            <label htmlFor="st-shippingPolicy" className="text-sm font-medium">Shipping policy</label>
            <Textarea id="st-shippingPolicy" value={f.shippingPolicy} onChange={(e) => set("shippingPolicy", e.target.value)} rows={2} maxLength={2000} />
          </div>
          <div className="grid gap-1">
            <label htmlFor="st-returnPolicy" className="text-sm font-medium">Return policy</label>
            <Textarea id="st-returnPolicy" value={f.returnPolicy} onChange={(e) => set("returnPolicy", e.target.value)} rows={2} maxLength={2000} />
          </div>
          <div>
            <Button type="submit" disabled={saving} className="bg-ali-red text-white hover:bg-ali-red-dark">
              {saving ? <Loader2 className="size-4 animate-spin" /> : null} Save profile
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
