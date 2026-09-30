"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, Pager } from "@/components/refine/ui";
import { readEnvelope } from "@/lib/api/client";
import { timeAgo } from "@/lib/format";

type SellerDispute = {
  id: string;
  category: string;
  reason: string;
  status: string;
  createdAt: string;
  order: { number: string; total: number; status: string };
  buyer: { email: string };
};

const PAGE_SIZE = 20;

export default function SellingDisputesPage() {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["selling-disputes", page],
    queryFn: async (): Promise<{ rows: SellerDispute[]; total: number }> => {
      const res = await fetch(`/api/v1/selling/disputes?page=${page}&pageSize=${PAGE_SIZE}`);
      if (res.status === 401) throw new Error("Sign in as a seller.");
      const envelope = await readEnvelope<SellerDispute[]>(res);
      return { rows: envelope.data ?? [], total: envelope.pagination?.total ?? 0 };
    },
    retry: false,
  });
  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Disputes</h1>
      <p className="-mt-1 text-sm text-neutral-500">Respond fast — open disputes freeze your escrow.</p>
      <Card className="overflow-hidden px-6 py-2">
        {query.isLoading ? (
          <p className="py-4 text-sm text-neutral-500">Loading disputes…</p>
        ) : query.isError ? (
          <p className="py-4 text-sm text-neutral-500">{query.error.message}</p>
        ) : rows.length === 0 ? (
          <div className="space-y-2 py-6 text-center text-sm text-neutral-500">
            <p>No disputes on your items. Open disputes freeze your escrow — respond fast if one appears.</p>
            <Button size="sm" variant="outline" asChild><Link href="/selling/orders">View your orders</Link></Button>
          </div>
        ) : (
          <ul className="divide-y">
            {rows.map((d) => (
              <li key={d.id}>
                <Link href={`/selling/disputes/${d.id}`} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">Order {d.order.number} · {d.category.replace(/_/g, " ")}</p>
                    <p className="truncate text-xs text-neutral-500">{d.reason}</p>
                    <p className="text-xs text-neutral-400">{d.buyer.email} · {timeAgo(d.createdAt)}</p>
                  </div>
                  <StatusBadge value={d.status} />
                  <ChevronRight className="size-4 text-neutral-400" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {pages > 1 ? <Pager page={page} pageCount={pages} total={total} onPage={setPage} /> : null}
    </div>
  );
}
