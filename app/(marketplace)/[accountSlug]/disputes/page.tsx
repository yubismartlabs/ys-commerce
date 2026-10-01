"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge, Pager } from "@/components/refine/ui";
import { SellerDisputes } from "@/components/disputes/seller-disputes";
import { readEnvelope } from "@/lib/api/client";
import { timeAgo } from "@/lib/format";
import { useAccountBase } from "@/lib/account-url";

type BuyerDispute = {
  id: string;
  category: string;
  reason: string;
  status: string;
  createdAt: string;
  order: { number: string; total: number; status: string };
};

const PAGE_SIZE = 20;

function BuyerDisputes() {
  const base = useAccountBase();
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["account-disputes", page],
    queryFn: async (): Promise<{ rows: BuyerDispute[]; total: number }> => {
      const res = await fetch(`/api/v1/account/disputes?page=${page}&pageSize=${PAGE_SIZE}`);
      if (res.status === 401) throw new Error("Sign in to see your disputes.");
      const envelope = await readEnvelope<BuyerDispute[]>(res);
      return { rows: envelope.data ?? [], total: envelope.pagination?.total ?? 0 };
    },
    retry: false,
  });
  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <Card className="px-6 py-2">
        {query.isLoading ? (
          <p className="py-4 text-sm text-neutral-500">Loading disputes…</p>
        ) : query.isError ? (
          <p className="py-4 text-sm text-red-600" role="alert">{query.error.message}</p>
        ) : rows.length === 0 ? (
          <div className="space-y-2 py-6 text-center text-sm text-neutral-500">
            <p>No disputes. Buyer protection covers every order.</p>
            <Button size="sm" variant="outline" asChild><Link href={`${base}/orders`}>View my orders</Link></Button>
          </div>
        ) : (
          <ul className="divide-y">
            {rows.map((d) => (
              <li key={d.id}>
                <Link href={`${base}/disputes/${d.id}`} className="flex items-center gap-3 py-3">
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
      {pages > 1 ? <Pager page={page} pageCount={pages} total={total} onPage={setPage} /> : null}
    </>
  );
}

/**
 * Unified disputes: opened by me (buyer protection) + against my store
 * (respond fast — open disputes freeze escrow). ?view=selling deep-links
 * from seller notifications.
 */
function DisputesTabs() {
  const base = useAccountBase();
  const search = useSearchParams();
  const router = useRouter();
  const view = search.get("view") === "selling" ? "selling" : "buying";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-bold">Disputes</h1>
      <Tabs value={view} onValueChange={(v) => router.replace(v === "selling" ? `${base}/disputes?view=selling` : `${base}/disputes`, { scroll: false })}>
        <TabsList>
          <TabsTrigger value="buying">Opened by me</TabsTrigger>
          <TabsTrigger value="selling">Against my store</TabsTrigger>
        </TabsList>
        <TabsContent value="buying"><BuyerDisputes /></TabsContent>
        <TabsContent value="selling">
          <Card className="px-6 py-2"><SellerDisputes /></Card>
        </TabsContent>
      </Tabs>
      <Button variant="ghost" size="sm" asChild><Link href={`${base}/summary`}>Back to summary</Link></Button>
    </div>
  );
}

export default function DisputesPage() {
  return (
    <Suspense fallback={<Card className="p-6 text-sm text-neutral-500">Loading disputes…</Card>}>
      <DisputesTabs />
    </Suspense>
  );
}
