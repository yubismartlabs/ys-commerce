"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/refine/ui";
import { formatUSD, timeAgo } from "@/lib/format";
import type { Order } from "@/lib/refine/types";

/** Buyer's real order history for the account tab. */
export function AccountOrders() {
  const query = useQuery({
    queryKey: ["account-orders"],
    queryFn: async (): Promise<Order[]> => {
      const res = await fetch("/api/v1/account/orders?pageSize=20");
      if (res.status === 401) throw new Error("Sign in to see your orders.");
      if (!res.ok) throw new Error("Couldn't load orders.");
      return (await res.json()).data as Order[];
    },
    retry: false,
  });

  if (query.isLoading) return <p className="text-sm text-neutral-500">Loading orders…</p>;
  if (query.isError) return <p className="text-sm text-neutral-500">{query.error.message}</p>;
  if (!query.data || query.data.length === 0) {
    return (
      <div className="text-sm text-neutral-500">
        <p>No orders yet.</p>
        <Button size="sm" variant="outline" asChild className="mt-2"><Link href="/">Start shopping</Link></Button>
      </div>
    );
  }

  return (
    <ul className="divide-y">
      {query.data.map((o) => (
        <li key={o.id}>
          <Link href={`/account/orders/${encodeURIComponent(o.number)}`} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-sm font-bold">{o.number}</p>
              <p className="text-xs text-neutral-500">
                {o.items.reduce((a, i) => a + i.qty, 0)} items · {timeAgo(o.createdAt)}
              </p>
            </div>
            <StatusBadge value={o.status} />
            <span className="text-sm font-bold tabular-nums">{formatUSD(o.total)}</span>
            <ChevronRight className="size-4 text-neutral-400" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
