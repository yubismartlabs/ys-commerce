"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge, Pager, EmptyState, ErrorState } from "@/components/refine/ui";
import { formatUSD, timeAgo } from "@/lib/format";
import { useAccountBase } from "@/lib/account-url";
import { returnReasonLabel } from "@/lib/returns/returns-labels";
import type { ReturnView } from "@/lib/refine/types";

const PAGE_SIZE = 20;
const FILTERS = ["REQUESTED", "ACCEPTED", "RECEIVED", "REFUNDED", "REJECTED"] as const;

/**
 * Seller return queue.
 *
 * Returning items are ordinary business, not misconduct — a high return rate
 * is a signal about the listing, not a reason to penalise the seller, which is
 * why this is a queue rather than a dispute thread.
 */
export function SellerReturns() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["account-store-returns", status ?? "all", page],
    queryFn: async (): Promise<{ rows: ReturnView[]; total: number }> => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (status) params.set("status", status);
      const res = await fetch(`/api/v1/account/selling/returns?${params.toString()}`);
      if (res.status === 401) throw new Error("Sign in to view returns on your store.");
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Couldn't load returns.");
      return { rows: json.data ?? [], total: json.pagination?.total ?? 0 };
    },
    retry: false,
  });

  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={status === s ? "default" : "outline"}
              aria-pressed={status === s}
              className="rounded-full"
              onClick={() => {
                setStatus(status === s ? undefined : s);
                setPage(1);
              }}
            >
              {s}
            </Button>
          ))}
        </div>
      </div>
      <p className="-mt-1 text-sm text-neutral-500">
        A return is a buyer exercising ordinary after-sales rights — it does not affect your dispute
        record. Refunds are released by support once you confirm the item came back.
      </p>

      {query.isLoading ? (
        <Card className="p-6 text-sm text-neutral-500">Loading returns…</Card>
      ) : query.isError ? (
        <Card className="p-0"><ErrorState message={query.error instanceof Error ? query.error.message : "Couldn't load returns."} /></Card>
      ) : rows.length === 0 ? (
        <Card className="p-0">
          <EmptyState icon={RotateCcw} title="No returns" hint="Nothing to action right now." />
        </Card>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <ReturnRow key={r.id} value={r} onDone={() => {
              queryClient.invalidateQueries({ queryKey: ["account-store-returns"] });
              queryClient.invalidateQueries({ queryKey: ["account-payouts"] });
            }} />
          ))}
        </ul>
      )}
      {pages > 1 ? <Pager page={page} pageCount={pages} total={total} onPage={setPage} /> : null}
    </div>
  );
}

function ReturnRow({ value, onDone }: { value: ReturnView & { buyer?: { email: string; name: string | null }; order?: { number: string } }; onDone: () => void }) {
  const base = useAccountBase();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const act = async (to: "ACCEPTED" | "REJECTED" | "RECEIVED") => {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/account/selling/returns/${value.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, ...(note.trim() ? { note: note.trim() } : {}) }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Update failed.");
      toast.success(
        to === "ACCEPTED" ? "Return accepted — send the buyer return instructions." :
        to === "RECEIVED" ? "Marked received — support will release the refund." :
        "Return rejected."
      );
      setNote("");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  };

  const lines = (value.items ?? []) as Array<{ title: string; qty: number; price: number }>;
  const gross = lines.reduce((a, l) => a + l.price * l.qty, 0);

  return (
    <li>
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge value={value.status} />
          <Link href={`${base}/sales/${value.orderId}`} className="font-mono text-sm font-bold hover:underline">
            {value.order?.number ?? value.orderId}
          </Link>
          <Badge variant="secondary" className="text-[11px]">{returnReasonLabel(value.reason)}</Badge>
          <span className="text-xs text-neutral-500">{value.buyer?.email} · {timeAgo(value.createdAt)}</span>
          <span className="ml-auto font-bold tabular-nums">{formatUSD(gross)}</span>
        </div>

        <ul className="mt-2 space-y-0.5 text-sm">
          {lines.map((l, i) => (
            <li key={i} className="text-neutral-600 dark:text-neutral-300">
              {l.title} × {l.qty}
            </li>
          ))}
        </ul>

        {value.note ? (
          <p className="mt-2 rounded-lg bg-neutral-100 p-2 text-sm dark:bg-neutral-800">
            <span className="font-semibold">Buyer: </span>{value.note}
          </p>
        ) : null}
        {value.sellerNote ? (
          <p className="mt-1 rounded-lg bg-neutral-100 p-2 text-sm dark:bg-neutral-800">
            <span className="font-semibold">You: </span>{value.sellerNote}
          </p>
        ) : null}

        {["REQUESTED", "ACCEPTED"].includes(value.status) ? (
          <div className="mt-3 space-y-2">
            <label htmlFor={`rn-${value.id}`} className="text-xs font-semibold text-neutral-600">
              Note to buyer (optional)
            </label>
            <Textarea
              id={`rn-${value.id}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="e.g. Return postage is on you; we'll refund within 3 days of arrival."
            />
            <div className="flex flex-wrap gap-2">
              {value.status === "REQUESTED" ? (
                <Button size="sm" disabled={busy} onClick={() => act("ACCEPTED")} className="bg-ali-red text-white hover:bg-ali-red-dark">
                  {busy ? <Loader2 className="size-4 animate-spin" /> : null} Accept
                </Button>
              ) : (
                <Button size="sm" disabled={busy} onClick={() => act("RECEIVED")} className="bg-ali-red text-white hover:bg-ali-red-dark">
                  {busy ? <Loader2 className="size-4 animate-spin" /> : null} Item received
                </Button>
              )}
              <Button size="sm" variant="outline" disabled={busy} onClick={() => act("REJECTED")}>
                Reject
              </Button>
              {value.status === "REQUESTED" ? (
                <Button size="sm" variant="ghost" asChild>
                  <Link href={`${base}/messages`}>Message buyer <ChevronRight className="size-3.5" /></Link>
                </Button>
              ) : null}
            </div>
          </div>
        ) : value.status === "RECEIVED" ? (
          <p className="mt-2 rounded-lg bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
            Waiting on support to release the refund{value.refundAmount ? ` of ${formatUSD(value.refundAmount)}` : ""}.
          </p>
        ) : null}
      </Card>
    </li>
  );
}
