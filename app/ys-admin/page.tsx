"use client";

import Link from "next/link";
import { useGetIdentity } from "@refinedev/core";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/refine/ui";
import { formatUSD, timeAgo } from "@/lib/format";
import { hasScope } from "@/lib/auth/permissions";
import { useHydrated } from "@/lib/hooks/use-hydrated";

type Identity = { email?: string; name?: string | null; role?: string; scopes?: string[] };

type Stats = {
  gmv30d: number;
  vendors: number;
  orders: number;
  openDisputes: number;
  activeProducts: number;
  currency: string;
};

async function getJSON(path: string) {
  const res = await fetch(path);
  if (res.status === 403) return null;
  if (!res.ok) throw new Error("load failed");
  return res.json();
}

function useStats(scopes: string[]) {
  return useQuery({
    queryKey: ["admin-dash-stats"],
    queryFn: async (): Promise<Stats | null> => {
      if (!hasScope(scopes, "ops")) return null;
      const json = await getJSON("/api/v1/admin/stats");
      return json ? (json.data as Stats) : null;
    },
    retry: false,
  });
}

function useTotal(path: string, scope: string, scopes: string[]) {
  return useQuery({
    queryKey: ["admin-dash-count", path],
    queryFn: async (): Promise<number | null> => {
      if (!hasScope(scopes, scope)) return null;
      const json = await getJSON(`${path}&pageSize=1`);
      return json ? (json.pagination.total as number) : null;
    },
    retry: false,
  });
}

function useActivity(scopes: string[]) {
  return useQuery({
    queryKey: ["admin-dash-activity"],
    queryFn: async (): Promise<Array<{ id: string; action: string; entity: string; createdAt: string; actor: { email: string; name: string | null } | null }>> => {
      if (!hasScope(scopes, "ops")) return [];
      const json = await getJSON("/api/v1/admin/audit?pageSize=8");
      return json ? json.data : [];
    },
    retry: false,
  });
}

function Kpi({ label, value, href }: { label: string; value: string; href?: string }) {
  const body = (
    <>
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="text-xl font-extrabold tabular-nums">{value}</p>
    </>
  );
  return (
    <Card className="p-4">
      {href ? <Link href={href} className="block hover:opacity-80">{body}</Link> : body}
    </Card>
  );
}

export default function AdminDashboard() {
  const { data: identity } = useGetIdentity<Identity>();
  const scopes = identity?.scopes ?? [];
  // Identity loads client-side after the SSR prerender, so the first client
  // render can already know the user's name while the server HTML has the
  // "there" fallback. Rendering the name immediately causes a hydration
  // mismatch ("Hello, there" vs "Hello, YS"). Wait until after hydration to
  // personalize so server HTML and the first client render agree.
  const mounted = useHydrated();
  const name = mounted ? identity?.name || identity?.email || "there" : "there";

  const stats = useStats(scopes);
  const pendingVendors = useTotal("/api/v1/admin/vendors?status=PENDING", "vendors", scopes);
  const openDisputes = useTotal("/api/v1/admin/disputes?status=OPEN", "disputes", scopes);
  const paidOrders = useTotal("/api/v1/admin/orders?status=PAID", "orders", scopes);
  const activity = useActivity(scopes);
  const s = stats.data;

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Hello, ${name.split(" ")[0]}`}
        description="Marketplace health at a glance — queues that need you first."
      />

      {s ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Kpi label="GMV (paid+)" value={formatUSD(s.gmv30d)} href="/ys-admin/orders" />
          <Kpi label="Orders" value={String(s.orders)} href="/ys-admin/orders" />
          <Kpi label="Vendors" value={String(s.vendors)} href="/ys-admin/vendors" />
          <Kpi label="Open disputes" value={String(s.openDisputes)} href="/ys-admin/disputes" />
          <Kpi label="Active products" value={String(s.activeProducts)} href="/ys-admin/products" />
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="space-y-2 p-4">
          <p className="font-bold">Needs attention</p>
          {pendingVendors.data !== null && pendingVendors.data !== undefined ? (
            <Button variant="ghost" size="sm" asChild className="w-full justify-between">
              <Link href="/ys-admin/vendors">
                {pendingVendors.data} vendors pending approval <ChevronRight className="size-4" />
              </Link>
            </Button>
          ) : null}
          {openDisputes.data !== null && openDisputes.data !== undefined ? (
            <Button variant="ghost" size="sm" asChild className="w-full justify-between">
              <Link href="/ys-admin/disputes">
                {openDisputes.data} open disputes <ChevronRight className="size-4" />
              </Link>
            </Button>
          ) : null}
          {paidOrders.data !== null && paidOrders.data !== undefined ? (
            <Button variant="ghost" size="sm" asChild className="w-full justify-between">
              <Link href="/ys-admin/orders">
                {paidOrders.data} paid orders to fulfill <ChevronRight className="size-4" />
              </Link>
            </Button>
          ) : null}
          {pendingVendors.data === null && openDisputes.data === null && paidOrders.data === null ? (
            <p className="text-sm text-neutral-500">Use the sidebar to browse your areas.</p>
          ) : null}
        </Card>

        <Card className="space-y-2 p-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <p className="font-bold">Recent activity</p>
            <Button size="sm" variant="ghost" asChild>
              <Link href="/ys-admin/activity">View all <ChevronRight className="size-4" /></Link>
            </Button>
          </div>
          {!activity.data || activity.data.length === 0 ? (
            <p className="text-sm text-neutral-500">No recent activity.</p>
          ) : (
            <ul className="divide-y">
              {activity.data.map((a) => (
                <li key={a.id} className="flex items-center gap-2 py-1.5 font-mono text-xs">
                  <span className="rounded bg-neutral-100 px-1.5 py-0.5 dark:bg-neutral-800">{a.action}</span>
                  <span className="truncate text-neutral-500">{a.actor?.email ?? "system"} · {a.entity}</span>
                  <span className="ml-auto shrink-0 text-neutral-400">{timeAgo(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
