"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/refine/ui";
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

export default function SellingDisputesPage() {
  const query = useQuery({
    queryKey: ["selling-disputes"],
    queryFn: async (): Promise<SellerDispute[]> => {
      const res = await fetch("/api/v1/selling/disputes");
      if (res.status === 401) throw new Error("Sign in as a seller.");
      if (!res.ok) throw new Error("Couldn't load disputes.");
      return (await res.json()).data as SellerDispute[];
    },
    retry: false,
  });
  const rows = query.data ?? [];

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
          <p className="py-4 text-sm text-neutral-500">No disputes on your items.</p>
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
    </div>
  );
}
