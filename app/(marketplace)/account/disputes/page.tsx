"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/refine/ui";
import { timeAgo } from "@/lib/format";

type BuyerDispute = {
  id: string;
  category: string;
  reason: string;
  status: string;
  createdAt: string;
  order: { number: string; total: number; status: string };
};

export default function BuyerDisputesPage() {
  const query = useQuery({
    queryKey: ["account-disputes"],
    queryFn: async (): Promise<BuyerDispute[]> => {
      const res = await fetch("/api/v1/account/disputes");
      if (res.status === 401) throw new Error("Sign in to see your disputes.");
      if (!res.ok) throw new Error("Couldn't load disputes.");
      return (await res.json()).data as BuyerDispute[];
    },
    retry: false,
  });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-bold">My disputes</h1>
      <Card className="px-6 py-2">
        {query.isLoading ? (
          <p className="py-4 text-sm text-neutral-500">Loading disputes…</p>
        ) : query.isError ? (
          <p className="py-4 text-sm text-neutral-500">{query.error.message}</p>
        ) : !query.data || query.data.length === 0 ? (
          <p className="py-4 text-sm text-neutral-500">No disputes. Buyer protection covers every order.</p>
        ) : (
          <ul className="divide-y">
            {query.data.map((d) => (
              <li key={d.id}>
                <Link href={`/account/disputes/${d.id}`} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">Order {d.order.number} · {d.category.replace(/_/g, " ")}</p>
                    <p className="truncate text-xs text-neutral-500">{d.reason}</p>
                    <p className="text-xs text-neutral-400">Opened {timeAgo(d.createdAt)}</p>
                  </div>
                  <StatusBadge value={d.status} />
                  <ChevronRight className="size-4 text-neutral-400" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Button variant="ghost" size="sm" asChild><Link href="/account">Back to account</Link></Button>
    </div>
  );
}
