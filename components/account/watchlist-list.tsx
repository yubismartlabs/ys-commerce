"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { WatchRowActions } from "@/components/account/watch-row-actions";
import { useCart } from "@/lib/store/cart";
import { usePublicSettings } from "@/lib/public-settings";
import { readEnvelope } from "@/lib/api/client";
import { formatUSD, timeAgo } from "@/lib/format";

export type WatchlistItem = {
  id: string;
  targetPrice: number | null;
  createdAt: string;
  product: {
    slug: string;
    title: string;
    image: string;
    price: number;
    compareAt: number | null;
    ratingAvg: number;
    ratingCount: number;
    soldCount: number;
    badge: string | null;
    freeShipping: boolean;
    status: string;
    category: string;
    variants: Array<{ stock: number }>;
    store: { id: string; name: string; slug: string; username: string | null };
  };
};

async function fetchWishlist(): Promise<WatchlistItem[]> {
  const res = await fetch("/api/v1/account/wishlist?pageSize=50");
  if (res.status === 401) throw new Error("Sign in to see your wishlist.");
  if (!res.ok) throw new Error("Couldn't load wishlist.");
  return (await res.json()).data as WatchlistItem[];
}

/**
 * Shared watchlist rows: same list on the standalone /watchlist page (linked
 * from the storefront header) and on the in-shell Activity -> Watchlist page.
 * Row anatomy matches Recently Viewed: thumb, title, store · time, row
 * actions, price-alert editor, price + delivery line, Add to cart, Remove.
 */
export function WatchlistList({ signInNext }: { signInNext: string }) {
  const queryClient = useQueryClient();
  const add = useCart((s) => s.add);
  const { etaText, accountSlug } = usePublicSettings();
  const base = `/${accountSlug || "account"}`;
  const query = useQuery({ queryKey: ["wishlist"], queryFn: fetchWishlist, retry: false });
  const rows = useMemo(() => query.data ?? [], [query.data]);
  // Same client-side filters as the Summary watching list.
  const [filterQ, setFilterQ] = useState("");
  const [filterSort, setFilterSort] = useState("newest");
  const [filterStock, setFilterStock] = useState<"all" | "in" | "out">("all");

  // Per-item delivery quote, same per-line mode as Recently Viewed.
  const liveSlugs = useMemo(() => rows.map((i) => i.product.slug), [rows]);
  const shipping = useQuery({
    queryKey: ["watchlist-shipping", liveSlugs.join(",")],
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

  const outOfStock = (p: WatchlistItem["product"]) =>
    p.variants.length > 0 && p.variants.every((v) => v.stock <= 0);

  const filtered = useMemo(() => {
    const q = filterQ.trim().toLowerCase();
    const kept = rows.filter((item) => {
      if (q && !`${item.product.title} ${item.product.store.name}`.toLowerCase().includes(q)) return false;
      const out = outOfStock(item.product);
      if (filterStock === "in" && out) return false;
      if (filterStock === "out" && !out) return false;
      return true;
    });
    const price = (i: WatchlistItem) => Number(i.product.price);
    return [...kept].sort((a, b) =>
      filterSort === "price-asc"
        ? price(a) - price(b)
        : filterSort === "price-desc"
          ? price(b) - price(a)
          : +new Date(b.createdAt) - +new Date(a.createdAt)
    );
  }, [rows, filterQ, filterSort, filterStock]);

  const remove = async (slug: string) => {
    try {
      const res = await fetch(`/api/v1/account/wishlist/${encodeURIComponent(slug)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Remove failed.");
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
    } catch {
      toast.error("Remove failed.");
    }
  };

  if (query.isLoading) {
    return (
      <Card className="px-6 py-2">
        <ul className="divide-y" aria-label="Loading watchlist">
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
      </Card>
    );
  }
  if (query.isError) {
    return (
      <Card className="space-y-2 p-6 text-sm text-neutral-500">
        <p>{query.error.message}</p>
        <Button size="sm" variant="outline" asChild>
          <Link href={`/sign-in?next=${encodeURIComponent(signInNext)}`}>Sign in</Link>
        </Button>
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card className="space-y-2 p-10 text-center text-sm text-neutral-500">
        <p>Nothing saved yet. Heart any product to watch its price.</p>
        <Button size="sm" asChild><Link href="/">Discover products</Link></Button>
      </Card>
    );
  }

  return (
    <Card className="px-6 py-2">
      <div className="flex flex-wrap items-center gap-2 border-b py-2.5">
        <Input
          value={filterQ}
          onChange={(e) => setFilterQ(e.target.value)}
          placeholder="Search watched items…"
          aria-label="Search watched items"
          className="h-8 max-w-48 text-sm"
        />
        <Select value={filterSort} onValueChange={setFilterSort}>
          <SelectTrigger size="sm" className="w-36" aria-label="Sort watched items">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Recently added</SelectItem>
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
      {filtered.length === 0 ? (
        <div className="space-y-2 py-6 text-center text-sm text-neutral-500">
          <p>No watched items match these filters.</p>
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
      ) : (
      <ul className="divide-y">
        {filtered.map((item) => {
          const out = outOfStock(item.product);
          return (
            <li key={item.id} className="flex items-center gap-3 py-2.5">
              <Link
                href={`/product/${item.product.slug}`}
                className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-neutral-100"
              >
                <Image src={item.product.image} alt="" fill sizes="56px" className="object-cover" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/product/${item.product.slug}`}
                  className="line-clamp-1 block truncate text-sm font-medium hover:underline"
                >
                  {item.product.title}
                </Link>
                <p className="truncate text-xs text-neutral-500">
                  {item.product.store.name} · {timeAgo(item.createdAt)}
                </p>
                <WatchRowActions
                  item={{
                    slug: item.product.slug,
                    title: item.product.title,
                    category: item.product.category,
                    store: item.product.store,
                  }}
                  base={base}
                />
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-bold tabular-nums">{formatUSD(Number(item.product.price))}</p>
                {(() => {
                  const cost = shipCost(item.product.slug);
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
                {out ? (
                  <p className="text-[11px] font-semibold text-amber-600">Out of stock</p>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      add(
                        {
                          slug: item.product.slug,
                          title: item.product.title,
                          image: item.product.image,
                          price: Number(item.product.price),
                          storeId: item.product.store.id,
                          storeName: item.product.store.name,
                          storeSlug: item.product.store.slug,
                          freeShipping: item.product.freeShipping,
                        },
                        1
                      );
                      toast.success("Added to cart.");
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-500 hover:text-neutral-900"
                  >
                    <ShoppingCart className="size-3" /> Add to cart
                  </button>
                )}
              </div>
              <Button size="sm" variant="ghost" className="h-8 shrink-0 gap-1 text-xs text-neutral-500" onClick={() => remove(item.product.slug)}>
                <Trash2 className="size-3.5" /> Remove
              </Button>
            </li>
          );
        })}
      </ul>
      )}
    </Card>
  );
}
