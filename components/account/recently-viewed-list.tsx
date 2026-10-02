"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShoppingCart, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorCard } from "@/components/commerce/query-error";
import { WatchRowActions } from "@/components/account/watch-row-actions";
import { readEnvelope } from "@/lib/api/client";
import { useAccountBase } from "@/lib/account-url";
import { usePublicSettings } from "@/lib/public-settings";
import { useCart } from "@/lib/store/cart";
import { formatUSD, timeAgo } from "@/lib/format";

type RecentRow = {
  viewedAt: string;
  product: {
    id: string;
    slug: string;
    title: string;
    image: string;
    price: number;
    category: string;
    freeShipping: boolean;
    variants: Array<{ stock: number }>;
    store: { id: string; name: string; slug: string; username: string | null };
  };
};

const KEY = ["account-recently-viewed"];

/**
 * My YS -> Activity -> Recently viewed: what this buyer looked at, newest
 * first, capped server-side at 50.
 */
export function RecentlyViewedList() {
  const qc = useQueryClient();
  const base = useAccountBase();
  const { etaText } = usePublicSettings();
  const add = useCart((s) => s.add);
  const [pending, setPending] = useState<string | null>(null);
  // Same client-side filters as the Summary watching list: the history
  // arrives whole (≤50), so filtering in memory costs no round trips.
  const [filterQ, setFilterQ] = useState("");
  const [filterSort, setFilterSort] = useState("newest");
  const [filterStock, setFilterStock] = useState<"all" | "in" | "out">("all");

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

  const rows = useMemo(() => query.data?.rows ?? [], [query.data]);
  const max = query.data?.max ?? 50;

  // What each item would cost to ship bought alone. One request for the
  // whole list, keyed by slug — same per-line mode the Summary list uses.
  const liveSlugs = useMemo(() => rows.map((r) => r.product.slug), [rows]);
  const shipping = useQuery({
    queryKey: ["recently-viewed-shipping", liveSlugs.join(",")],
    queryFn: async (): Promise<Map<string, number>> => {
      const params = new URLSearchParams({
        lines: JSON.stringify(liveSlugs.map((slug) => ({ slug, qty: 1 }))),
        perLine: "1",
      });
      const res = await fetch(`/api/v1/cart/shipping?${params.toString()}`);
      const envelope = await readEnvelope<Array<{ slug: string; cost: number }>>(res);
      return new Map((envelope.data ?? []).map((l) => [l.slug, l.cost]));
    },
    retry: false,
    enabled: liveSlugs.length > 0,
  });
  const shipCost = (slug: string): number | null => shipping.data?.get(slug) ?? null;

  const outOfStock = (p: RecentRow["product"]) =>
    p.variants.length > 0 && p.variants.every((v) => v.stock <= 0);

  const filtered = useMemo(() => {
    const q = filterQ.trim().toLowerCase();
    const kept = rows.filter((r) => {
      if (q && !`${r.product.title} ${r.product.store.name}`.toLowerCase().includes(q)) return false;
      const out = outOfStock(r.product);
      if (filterStock === "in" && out) return false;
      if (filterStock === "out" && !out) return false;
      return true;
    });
    const price = (r: RecentRow) => Number(r.product.price);
    return [...kept].sort((a, b) =>
      filterSort === "price-asc"
        ? price(a) - price(b)
        : filterSort === "price-desc"
          ? price(b) - price(a)
          : +new Date(b.viewedAt) - +new Date(a.viewedAt)
    );
  }, [rows, filterQ, filterSort, filterStock]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b py-2.5">
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
      {rows.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-b py-2.5">
          <Input
            value={filterQ}
            onChange={(e) => setFilterQ(e.target.value)}
            placeholder="Search viewed items…"
            aria-label="Search viewed items"
            className="h-8 max-w-48 text-sm"
          />
          <Select value={filterSort} onValueChange={setFilterSort}>
            <SelectTrigger size="sm" className="w-36" aria-label="Sort viewed items">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Recently viewed</SelectItem>
              <SelectItem value="price-asc">Price: low to high</SelectItem>
              <SelectItem value="price-desc">Price: high to low</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            {(["all", "in", "out"] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={filterStock === s ? "default" : "outline"}
                aria-pressed={filterStock === s}
                className="h-8 rounded-full text-xs"
                onClick={() => setFilterStock(s)}
              >
                {s === "all" ? "All" : s === "in" ? "In stock" : "Out of stock"}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
      {query.isLoading ? (
        <ul className="divide-y" aria-label="Loading recently viewed">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 py-2.5">
              <Skeleton className="size-14 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-4 w-16 shrink-0" />
            </li>
          ))}
        </ul>
      ) : null}

      {rows.length > 0 && filtered.length === 0 && !query.isLoading ? (
        <div className="space-y-2 py-6 text-center text-sm text-neutral-500">
          <p>No viewed items match these filters.</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setFilterQ("");
              setFilterSort("newest");
              setFilterStock("all");
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : null}

      {filtered.length > 0 ? (
        <ul className="divide-y">
          {filtered.map((r) => (
            <li key={r.product.id} className="flex items-center gap-3 py-2.5">
              <Link
                href={`/product/${r.product.slug}`}
                className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-neutral-100"
              >
                <Image
                  src={r.product.image}
                  alt=""
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/product/${r.product.slug}`}
                  className="line-clamp-1 block truncate text-sm font-medium hover:underline"
                >
                  {r.product.title}
                </Link>
                <p className="truncate text-xs text-neutral-500">
                  {r.product.store.name} · {timeAgo(r.viewedAt)}
                </p>
                <WatchRowActions
                  item={{
                    slug: r.product.slug,
                    title: r.product.title,
                    category: r.product.category,
                    store: r.product.store,
                  }}
                  base={base}
                />
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-bold tabular-nums">
                  {formatUSD(r.product.price)}
                </p>
                {(() => {
                  const cost = shipCost(r.product.slug);
                  if (cost === null) return <p className="text-[11px] text-neutral-500">{etaText}</p>;
                  if (cost === 0)
                    return (
                      <p className="text-[11px]">
                        <span className="font-semibold text-emerald-600">Free Delivery</span>
                        <span className="text-neutral-500"> · {etaText}</span>
                      </p>
                    );
                  return (
                    <p className="text-[11px] text-neutral-500 tabular-nums">
                      +{formatUSD(cost)} shipping · {etaText}
                    </p>
                  );
                })()}
                <button
                  type="button"
                  onClick={() => {
                    add(
                      {
                        slug: r.product.slug,
                        title: r.product.title,
                        image: r.product.image,
                        price: Number(r.product.price),
                        storeId: r.product.store.id,
                        storeName: r.product.store.name,
                        storeSlug: r.product.store.slug,
                        freeShipping: r.product.freeShipping,
                      },
                      1
                    );
                    toast.success("Added to cart.");
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-500 hover:text-neutral-900"
                >
                  <ShoppingCart className="size-3" /> Add to cart
                </button>
              </div>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Remove ${r.product.title} from recently viewed`}
                disabled={pending === r.product.slug}
                onClick={() => remove.mutate(r.product.slug)}
                className="size-8 shrink-0 rounded-full p-0 text-neutral-500 hover:text-neutral-900"
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
      ) : rows.length === 0 && query.isSuccess ? (
        <div className="space-y-2 py-6 text-center">
          <p className="text-sm text-neutral-500">
            Products you look at while signed in show up here.
          </p>
          <Button asChild size="sm" variant="outline" className="mt-3">
            <Link href="/">Browse the marketplace</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}