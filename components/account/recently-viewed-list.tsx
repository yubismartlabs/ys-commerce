"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorCard } from "@/components/commerce/query-error";
import { readEnvelope } from "@/lib/api/client";
import { formatUSD, timeAgo } from "@/lib/format";

type RecentRow = {
  viewedAt: string;
  product: {
    id: string;
    slug: string;
    title: string;
    image: string;
    price: number;
    store: { name: string; slug: string };
  };
};

const KEY = ["account-recently-viewed"];

/**
 * My YS -> Activity -> Recently viewed: what this buyer looked at, newest
 * first, capped server-side at 50.
 */
export function RecentlyViewedList() {
  const qc = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);

  const query = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const envelope = await readEnvelope<RecentRow[]>(await fetch("/api/v1/account/recently-viewed"));
      return { rows: envelope.data ?? [], max: Number(envelope.meta?.max ?? 50) };
    },
    retry: false,
  });

  const remove = useMutation({
    mutationFn: async (slug: string) => {
      const res = await fetch(`/api/v1/account/recently-viewed/${encodeURIComponent(slug)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Couldn't remove that item.");
    },
    onMutate: (slug: string) => {
      // Optimistic: the card should disappear under the cursor, not after a
      // round trip. Rolled back by the invalidate below on any failure.
      const previous = qc.getQueryData<{ rows: RecentRow[]; max: number }>(KEY);
      setPending(slug);
      qc.setQueryData<{ rows: RecentRow[]; max: number }>(KEY, (old) =>
        old ? { ...old, rows: old.rows.filter((r) => r.product.slug !== slug) } : old
      );
      return { previous };
    },
    onError: (_e, _slug, ctx) => {
      if (ctx?.previous) qc.setQueryData(KEY, ctx.previous);
      toast.error("Couldn't remove that item.");
    },
    onSettled: () => {
      setPending(null);
      qc.invalidateQueries({ queryKey: KEY });
    },
  });

  const clearAll = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/v1/account/recently-viewed", { method: "DELETE" });
      if (!res.ok) throw new Error("Couldn't clear your history.");
    },
    onSuccess: () => {
      toast.success("Recently viewed cleared.");
      qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't clear your history."),
  });

  const rows = query.data?.rows ?? [];
  const max = query.data?.max ?? 50;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-neutral-500">
          {rows.length === 0
            ? "Nothing here yet."
            : `${rows.length} of ${max} kept. We keep the most recent ${max}.`}
        </p>
        {rows.length > 0 ? (
          <Button
            size="sm"
            variant="outline"
            disabled={clearAll.isPending}
            onClick={() => clearAll.mutate()}
          >
            {clearAll.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            Clear all
          </Button>
        ) : null}
      </div>

      {query.isError ? <QueryErrorCard error={query.error} what="recently viewed" onRetry={() => query.refetch()} /> : null}
      {query.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      ) : null}

      {rows.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {rows.map((r) => (
            <li key={r.product.id} className="group relative">
              <Link href={`/product/${r.product.slug}`} className="block">
                <Card className="gap-0 overflow-hidden border-transparent bg-white p-0 shadow-none transition hover:border-black/5 hover:shadow-lg dark:bg-transparent">
                  <span className="relative block aspect-square overflow-hidden bg-neutral-100">
                    <Image
                      src={r.product.image}
                      alt={r.product.title}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      className="object-cover transition duration-300 group-hover:scale-105"
                    />
                  </span>
                  <span className="block space-y-0.5 p-2.5">
                    <span className="line-clamp-2 block text-[13px] font-medium group-hover:underline">
                      {r.product.title}
                    </span>
                    <span className="block text-[13px] font-bold tabular-nums">{formatUSD(r.product.price)}</span>
                    <span className="block truncate text-[11px] text-neutral-500">{r.product.store.name}</span>
                    <span className="block text-[11px] text-neutral-400">{timeAgo(r.viewedAt)}</span>
                  </span>
                </Card>
              </Link>
              <Button
                size="sm"
                variant="secondary"
                aria-label={`Remove ${r.product.title} from recently viewed`}
                disabled={pending === r.product.slug}
                onClick={() => remove.mutate(r.product.slug)}
                className="absolute right-1.5 top-1.5 size-7 rounded-full p-0 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
              >
                {pending === r.product.slug ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <X className="size-3.5" />
                )}
              </Button>
            </li>
          ))}
        </ul>
      ) : query.isSuccess ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-neutral-500">
            Products you look at while signed in show up here.
          </p>
          <Button asChild size="sm" variant="outline" className="mt-3">
            <Link href="/">Browse the marketplace</Link>
          </Button>
        </Card>
      ) : null}
    </div>
  );
}