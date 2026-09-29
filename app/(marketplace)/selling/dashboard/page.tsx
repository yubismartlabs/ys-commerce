"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/refine/ui";
import { formatUSD } from "@/lib/format";

type Dashboard = {
  stores: Array<{ id: string; name: string; slug: string; status: string; ratingAvg: number; followerCount: number }>;
  kpis: {
    revenue30d: number;
    orders30d: number;
    ratingAvg: number;
    ratingCount: number;
    activeListings: number;
    escrowHeld: number;
    escrowFrozen: number;
  } | null;
  recentOrders: Array<{ id: string; number: string; status: string; total: number; createdAt: string }>;
  openDisputes: Array<{ id: string; order: { number: string }; reason: string; status: string; createdAt: string }>;
  lowStock: Array<{ id: string; name: string; stock: number; product: { id: string; title: string } }>;
};

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="text-xl font-extrabold tabular-nums">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-neutral-400">{hint}</p> : null}
    </Card>
  );
}

export default function SellerDashboard() {
  const [storeId, setStoreId] = useState("");
  const query = useQuery({
    queryKey: ["selling-dashboard", storeId || "all"],
    queryFn: async (): Promise<Dashboard> => {
      const q = storeId ? `?storeId=${storeId}` : "";
      const res = await fetch(`/api/v1/selling/dashboard${q}`);
      if (res.status === 401) throw new Error("Sign in as a seller.");
      if (!res.ok) throw new Error("Couldn't load dashboard.");
      return (await res.json()).data as Dashboard;
    },
    retry: false,
  });
  const d = query.data;

  if (query.isLoading) return <Card className="p-6 text-sm text-neutral-500">Loading dashboard…</Card>;
  if (query.isError) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <Card className="space-y-2 p-6 text-sm text-neutral-500">
          <p>{query.error.message}</p>
          <Button size="sm" variant="outline" asChild><Link href="/selling/onboarding">Open a store</Link></Button>
        </Card>
      </div>
    );
  }
  if (!d || !d.kpis) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <Card className="space-y-2 p-6 text-sm text-neutral-500">
          <p>No stores yet.</p>
          <Button size="sm" variant="outline" asChild><Link href="/selling/onboarding">Open a store</Link></Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Dashboard</h1>
        {d.stores.length > 1 ? (
          <Select value={storeId || "all"} onValueChange={(v) => setStoreId(v === "all" ? "" : v)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stores</SelectItem>
              {d.stores.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {d.stores.some((s) => s.status !== "APPROVED") ? (
        <Card className="border-amber-400/50 bg-amber-400/10 p-4 text-sm">
          A store is awaiting approval — listings go live once approved.
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Revenue (30d)" value={formatUSD(d.kpis.revenue30d)} />
        <Kpi label="Orders (30d)" value={String(d.kpis.orders30d)} />
        <Kpi label="Rating" value={`${d.kpis.ratingAvg.toFixed(1)} ★`} hint={`${d.kpis.ratingCount} reviews`} />
        <Kpi label="Active listings" value={String(d.kpis.activeListings)} />
        <Kpi label="Escrow held" value={formatUSD(d.kpis.escrowHeld)} hint="Releases after protection" />
        <Kpi label="Escrow frozen" value={formatUSD(d.kpis.escrowFrozen)} hint="Tied up in disputes" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-bold">Recent orders</p>
            <Button size="sm" variant="ghost" asChild><Link href="/selling/orders">View all</Link></Button>
          </div>
          {d.recentOrders.length === 0 ? (
            <p className="text-sm text-neutral-500">No orders yet.</p>
          ) : (
            <ul className="divide-y">
              {d.recentOrders.map((o) => (
                <li key={o.id} className="flex items-center gap-2 py-2 text-sm">
                  <span className="font-mono font-bold">{o.number}</span>
                  <StatusBadge value={o.status} />
                  <span className="ml-auto font-bold tabular-nums">{formatUSD(o.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="grid gap-4">
          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-bold">Open disputes ({d.openDisputes.length})</p>
              <Button size="sm" variant="ghost" asChild><Link href="/selling/disputes">View all</Link></Button>
            </div>
            {d.openDisputes.length === 0 ? (
              <p className="text-sm text-neutral-500">Nothing open.</p>
            ) : (
              <ul className="divide-y">
                {d.openDisputes.map((x) => (
                  <li key={x.id} className="py-2 text-sm">
                    <Link href={`/selling/disputes/${x.id}`} className="flex items-center gap-2 hover:underline">
                      <span className="font-mono font-bold">{x.order.number}</span>
                      <StatusBadge value={x.status} />
                      <ChevronRight className="ml-auto size-4 text-neutral-400" />
                    </Link>
                    <p className="mt-0.5 line-clamp-1 text-xs text-neutral-500">{x.reason}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="p-4">
            <p className="mb-2 font-bold">Low stock (≤ 5)</p>
            {d.lowStock.length === 0 ? (
              <p className="text-sm text-neutral-500">All healthy.</p>
            ) : (
              <ul className="divide-y">
                {d.lowStock.map((v) => (
                  <li key={v.id} className="py-2 text-sm">
                    <Link href={`/selling/products/${v.product.id}`} className="hover:underline">
                      {v.product.title} <span className="text-neutral-500">· {v.name}</span>
                    </Link>
                    <span className="ml-2 font-bold tabular-nums text-amber-600">{v.stock} left</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
