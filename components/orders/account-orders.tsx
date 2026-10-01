"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge, Pager } from "@/components/refine/ui";
import { readEnvelope } from "@/lib/api/client";
import { useAccountBase } from "@/lib/account-url";
import { formatUSD, timeAgo } from "@/lib/format";
import type { Order } from "@/lib/refine/types";

const PAGE_SIZE = 20;

/** Buyer's real order history for the account tab. */
export function AccountOrders() {
  const base = useAccountBase();
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["account-orders", page],
    queryFn: async (): Promise<{ rows: Order[]; total: number }> => {
      const res = await fetch(`/api/v1/account/orders?page=${page}&pageSize=${PAGE_SIZE}`);
      if (res.status === 401) throw new Error("Sign in to see your orders.");
      const envelope = await readEnvelope<Order[]>(res);
      return { rows: envelope.data ?? [], total: envelope.pagination?.total ?? 0 };
    },
    retry: false,
  });

  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (query.isLoading) return <p className="text-sm text-neutral-500">Loading orders…</p>;
  if (query.isError) {
    return (
      <p className="text-sm text-red-600" role="alert">
        {query.error instanceof Error ? query.error.message : "Couldn't load orders."}{" "}
        <Button size="sm" variant="outline" className="ml-2" onClick={() => query.refetch()}>Retry</Button>
      </p>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="text-sm text-neutral-500">
        <p>No orders yet.</p>
        <Button size="sm" variant="outline" asChild className="mt-2"><Link href="/">Start shopping</Link></Button>
      </div>
    );
  }

  return (
    <>
      <ul className="divide-y">
        {rows.map((o) => (
          <li key={o.id}>
            <Link href={`${base}/orders/${encodeURIComponent(o.number)}`} className="flex items-center gap-3 py-3">
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
      {pages > 1 ? <Pager page={page} pageCount={pages} total={total} onPage={setPage} /> : null}
    </>
  );
}
