"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/refine/ui";
import { timeAgo } from "@/lib/format";

type BuyerDispute = {
  id: string;
  category: string;
  status: string;
  createdAt: string;
  order: { number: string; total: number; status: string };
};

async function fetchDisputes(): Promise<BuyerDispute[]> {
  const res = await fetch("/api/v1/account/disputes");
  if (res.status === 401) throw new Error("Sign in to see your disputes.");
  if (!res.ok) throw new Error("Couldn't load disputes.");
  return (await res.json()).data as BuyerDispute[];
}

/** Buyer's dispute inbox for the account tab. */
export function AccountDisputes() {
  const query = useQuery({ queryKey: ["account-disputes"], queryFn: fetchDisputes, retry: false });

  if (query.isLoading) return <p className="text-sm text-neutral-500">Loading disputes…</p>;
  if (query.isError) return <p className="text-sm text-neutral-500">{query.error.message}</p>;
  if (!query.data || query.data.length === 0) {
    return <p className="text-sm text-neutral-500">No disputes. File one from an order page if something goes wrong.</p>;
  }

  return (
    <ul className="divide-y">
      {query.data.map((d) => (
        <li key={d.id}>
          <Link href={`/account/disputes/${d.id}`} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">Order {d.order.number} · {d.category.replace(/_/g, " ")}</p>
              <p className="text-xs text-neutral-500">Opened {timeAgo(d.createdAt)}</p>
            </div>
            <StatusBadge value={d.status} />
            <ChevronRight className="size-4 text-neutral-400" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function AccountDisputesTab() {
  return (
    <div>
      <AccountDisputes />
      <Button size="sm" variant="outline" asChild className="mt-2">
        <Link href="/account/disputes">Open dispute center</Link>
      </Button>
    </div>
  );
}
