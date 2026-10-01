"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusBadge, Pager } from "@/components/refine/ui";
import { readEnvelope } from "@/lib/api/client";
import { formatUSD, timeAgo } from "@/lib/format";
import { returnReasonLabel } from "@/lib/returns/returns-labels";
import type { ReturnView } from "@/lib/refine/types";
import { useAccountBase } from "@/lib/account-url";

const PAGE_SIZE = 10;

const BLURB: Record<string, string> = {
  REQUESTED: "Waiting for the seller to respond.",
  ACCEPTED: "The seller accepted — send the item back as instructed.",
  RECEIVED: "Seller has the item. Support is releasing your refund.",
  REFUNDED: "Refunded.",
  REJECTED: "The seller declined this return.",
  CANCELLED: "You withdrew this request.",
};

/** The buyer's return requests and where each one stands. */
export function AccountReturnsTab() {
  const base = useAccountBase();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["account-returns", page],
    queryFn: async (): Promise<{ rows: ReturnView[]; total: number }> => {
      const envelope = await readEnvelope<ReturnView[]>(
        await fetch(`/api/v1/account/returns?page=${page}&pageSize=${PAGE_SIZE}`)
      );
      return { rows: envelope.data ?? [], total: envelope.pagination?.total ?? 0 };
    },
    retry: false,
  });

  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (query.isLoading) return <p className="text-sm text-neutral-500">Loading returns…</p>;
  if (query.isError) {
    return (
      <p className="text-sm text-red-600" role="alert">
        {query.error instanceof Error ? query.error.message : "Couldn't load returns."}
      </p>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="space-y-2 py-4 text-sm text-neutral-500">
        <p>No returns. If something isn&apos;t right, open a return from the order page — it&apos;s not a dispute and won&apos;t affect the seller&apos;s record.</p>
        <Button size="sm" variant="outline" asChild><Link href={`${base}/orders`}>View my orders</Link></Button>
      </div>
    );
  }

  const cancel = async (id: string) => {
    if (!window.confirm("Withdraw this return request?")) return;
    try {
      const res = await fetch(`/api/v1/account/returns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: "CANCELLED" }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Couldn't cancel.");
      toast.success("Return withdrawn.");
      queryClient.invalidateQueries({ queryKey: ["account-returns"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't cancel.");
    }
  };

  return (
    <>
      <ul className="divide-y">
        {rows.map((r) => {
          const lines = (r.items ?? []) as Array<{ title: string; qty: number; price: number }>;
          const gross = lines.reduce((a, l) => a + l.price * l.qty, 0);
          return (
            <li key={r.id} className="py-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge value={r.status} />
                <Link href={`${base}/orders/${encodeURIComponent(r.order?.number ?? "")}`} className="font-mono text-sm font-bold hover:underline">
                  {r.order?.number}
                </Link>
                <span className="text-xs text-neutral-500">{r.store?.name} · {timeAgo(r.createdAt)}</span>
                <span className="ml-auto text-sm font-bold tabular-nums">{formatUSD(gross)}</span>
              </div>
              <p className="mt-1 text-sm">{returnReasonLabel(r.reason)}</p>
              <p className="text-xs text-neutral-500">{BLURB[r.status] ?? ""}</p>
              <ul className="mt-1 space-y-0.5 text-xs text-neutral-600 dark:text-neutral-300">
                {lines.map((l, i) => (
                  <li key={i}>{l.title} × {l.qty}</li>
                ))}
              </ul>
              {r.sellerNote ? (
                <p className="mt-1.5 rounded-lg bg-neutral-100 p-2 text-xs dark:bg-neutral-800">
                  <span className="font-semibold">Seller: </span>{r.sellerNote}
                </p>
              ) : null}
              {r.refundAmount ? (
                <p className="mt-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  Refunded {formatUSD(r.refundAmount)}
                </p>
              ) : null}
              {r.status === "REQUESTED" ? (
                <Button size="sm" variant="ghost" className="mt-1" onClick={() => cancel(r.id)}>
                  Withdraw request
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {pages > 1 ? <Pager page={page} pageCount={pages} total={total} onPage={setPage} /> : null}
    </>
  );
}
