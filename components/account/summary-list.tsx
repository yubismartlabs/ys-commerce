"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/refine/ui";
import { WatchRowActions } from "@/components/account/watch-row-actions";
import { readEnvelope } from "@/lib/api/client";
import { useCart } from "@/lib/store/cart";
import { usePublicSettings } from "@/lib/public-settings";
import { formatUSD, timeAgo } from "@/lib/format";

type WatchItem = {
  id: string;
  createdAt: string;
  product: {
    slug: string;
    title: string;
    image: string;
    price: number;
    freeShipping: boolean;
    status: string;
    category: string;
    variants: Array<{ stock: number }>;
    store: { id: string; name: string; slug: string; username: string | null };
  };
};

type OrderRow = {
  id: string;
  number: string;
  status: string;
  total: number;
  createdAt: string;
  items: Array<{ qty: number }>;
};

/**
 * The summary is one list over two sources: what the buyer is watching and
 * what they bought. Watchlist rows are selectable for bulk removal; orders are
 * a read-only record, so they carry no checkboxes — selecting an order would
 * imply you could act on it, and there is nothing to do to one.
 */
export function SummaryList({ base }: { base: string }) {
  const queryClient = useQueryClient();
  const add = useCart((s) => s.add);
  const { etaText } = usePublicSettings();
  const [selected, setSelected] = useState<string[]>([]);
  const [removing, setRemoving] = useState(false);
  // Filters are client-side: both lists arrive whole (≤50 watched, 10 orders),
  // so filtering in memory is instant and costs no extra round trips.
  const [watchQ, setWatchQ] = useState("");
  const [watchSort, setWatchSort] = useState("newest");
  const [watchStock, setWatchStock] = useState<"all" | "in" | "out">("all");
  const [orderQ, setOrderQ] = useState("");
  const [orderStatus, setOrderStatus] = useState("all");
  const [orderSort, setOrderSort] = useState("newest");

  const watch = useQuery({
    queryKey: ["summary-watchlist"],
    queryFn: async (): Promise<WatchItem[]> => {
      const res = await fetch("/api/v1/account/wishlist?pageSize=50");
      if (res.status === 401) throw new Error("Sign in to see your watchlist.");
      const envelope = await readEnvelope<WatchItem[]>(res);
      return envelope.data ?? [];
    },
    retry: false,
  });

  const orders = useQuery({
    queryKey: ["summary-orders"],
    queryFn: async (): Promise<{ rows: OrderRow[]; total: number }> => {
      const res = await fetch("/api/v1/account/orders?page=1&pageSize=10");
      if (res.status === 401) throw new Error("Sign in to see your orders.");
      const envelope = await readEnvelope<OrderRow[]>(res);
      return { rows: envelope.data ?? [], total: envelope.pagination?.total ?? 0 };
    },
    retry: false,
  });

  // Memoised so the filter memos below see a stable identity — a bare
  // `watch.data ?? []` would hand them a fresh array every render and
  // re-sort on every keystroke-adjacent render for no reason.
  const rows = useMemo(() => watch.data ?? [], [watch.data]);
  const orderRows = useMemo(() => orders.data?.rows ?? [], [orders.data]);
  const orderTotal = orders.data?.total ?? 0;

  // What each watched item would cost to ship bought alone. One request for
  // the whole list, keyed by slug — a miss (dead listing, failed quote) means
  // no estimate rather than a wrong number.
  const liveSlugs = useMemo(
    () => rows.filter((r) => r.product.status === "ACTIVE").map((r) => r.product.slug),
    [rows]
  );
  const shipping = useQuery({
    queryKey: ["summary-shipping", liveSlugs.join(",")],
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

  const outOfStock = (p: WatchItem["product"]) =>
    p.variants.length > 0 && p.variants.every((v) => v.stock <= 0);

  const filteredWatch = useMemo(() => {
    const q = watchQ.trim().toLowerCase();
    const kept = rows.filter((item) => {
      if (q && !`${item.product.title} ${item.product.store.name}`.toLowerCase().includes(q)) return false;
      const out = outOfStock(item.product);
      if (watchStock === "in" && out) return false;
      if (watchStock === "out" && !out) return false;
      return true;
    });
    const price = (i: WatchItem) => Number(i.product.price);
    return [...kept].sort((a, b) =>
      watchSort === "price-asc"
        ? price(a) - price(b)
        : watchSort === "price-desc"
          ? price(b) - price(a)
          : +new Date(b.createdAt) - +new Date(a.createdAt)
    );
  }, [rows, watchQ, watchSort, watchStock]);

  const statuses = useMemo(() => {
    const counts = new Map<string, number>();
    for (const o of orderRows) counts.set(o.status, (counts.get(o.status) ?? 0) + 1);
    return [...counts.entries()];
  }, [orderRows]);

  const filteredOrders = useMemo(() => {
    const q = orderQ.trim().toLowerCase();
    const kept = orderRows.filter((o) => {
      if (orderStatus !== "all" && o.status !== orderStatus) return false;
      if (q && !o.number.toLowerCase().includes(q)) return false;
      return true;
    });
    return [...kept].sort((a, b) =>
      orderSort === "oldest"
        ? +new Date(a.createdAt) - +new Date(b.createdAt)
        : orderSort === "total-desc"
          ? Number(b.total) - Number(a.total)
          : orderSort === "total-asc"
            ? Number(a.total) - Number(b.total)
            : +new Date(b.createdAt) - +new Date(a.createdAt)
    );
  }, [orderRows, orderQ, orderStatus, orderSort]);
  // Select-all follows the visible rows: with a filter on, "all" means
  // everything you can see, not everything you own.
  const visibleSlugs = filteredWatch.map((r) => r.product.slug);
  const allSelected = visibleSlugs.length > 0 && visibleSlugs.every((s) => selected.includes(s));
  const toggle = (slug: string) =>
    setSelected((s) => (s.includes(slug) ? s.filter((x) => x !== slug) : [...s, slug]));

  const removeSelected = async () => {
    if (selected.length === 0 || removing) return;
    setRemoving(true);
    try {
      const res = await fetch("/api/v1/account/wishlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slugs: selected }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Remove failed.");
      toast.success(
        selected.length === 1 ? "Removed from your watchlist." : `Removed ${selected.length} items.`
      );
      setSelected([]);
      queryClient.invalidateQueries({ queryKey: ["summary-watchlist"] });
      // The standalone watchlist page reads its own key; leave it fresh too.
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Remove failed.");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="space-y-2" aria-labelledby="summary-watching">
        <h2 id="summary-watching" className="text-sm font-bold">
          Watching{watch.data ? ` (${rows.length})` : ""}
        </h2>
        {watch.isLoading ? (
          <Card className="p-6 text-sm text-neutral-500">Loading your watchlist…</Card>
        ) : watch.isError ? (
          <Card className="space-y-2 p-6 text-sm text-neutral-500">
            <p>{watch.error.message}</p>
            <Button size="sm" variant="outline" asChild>
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </Card>
        ) : rows.length === 0 ? (
          <Card className="space-y-2 p-10 text-center text-sm text-neutral-500">
            <p>Nothing saved yet. Heart any product to watch its price.</p>
            <Button size="sm" asChild>
              <Link href="/">Discover products</Link>
            </Button>
          </Card>
        ) : (
          <Card className="px-6 py-2">
              <div className="flex flex-wrap items-center gap-2 border-b py-2.5">
                <Input
                  value={watchQ}
                  onChange={(e) => setWatchQ(e.target.value)}
                  placeholder="Search watched items…"
                  aria-label="Search watched items"
                  className="h-8 max-w-48 text-sm"
                />
                <Select value={watchSort} onValueChange={setWatchSort}>
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
                      variant={watchStock === s ? "default" : "outline"}
                      aria-pressed={watchStock === s}
                      className="h-8 rounded-full text-xs"
                      onClick={() => setWatchStock(s)}
                    >
                      {s === "all" ? "All" : s === "in" ? "In stock" : "Out of stock"}
                    </Button>
                  ))}
                </div>
              </div>
              {filteredWatch.length === 0 ? (
                <div className="space-y-2 py-6 text-center text-sm text-neutral-500">
                  <p>No watched items match these filters.</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setWatchQ("");
                      setWatchSort("newest");
                      setWatchStock("all");
                    }}
                  >
                    Clear filters
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 border-b py-2.5">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={() => setSelected(allSelected ? [] : visibleSlugs)}
                  aria-label="Select all watched items"
                />
                <span className="text-sm text-neutral-500">
                  {selected.length > 0 ? `${selected.length} selected` : "Select items to remove"}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto h-8 gap-1 text-xs text-neutral-500"
                  disabled={selected.length === 0 || removing}
                  onClick={removeSelected}
                >
                  <Trash2 className="size-3.5" />
                  Remove{selected.length > 0 ? ` (${selected.length})` : ""}
                </Button>
              </div>
              <ul className="divide-y">
                {filteredWatch.map((item) => {
                  const out = outOfStock(item.product);
                  const checked = selected.includes(item.product.slug);
                  return (
                    <li key={item.id} className="flex items-center gap-3 py-2.5">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggle(item.product.slug)}
                        aria-label={`Select ${item.product.title}`}
                      />
                      <Link href={`/product/${item.product.slug}`} className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
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
                          return cost === 0 ? (
                            <p className="text-[11px]">
                              <span className="font-semibold text-emerald-600">Free Delivery</span>
                              <span className="text-neutral-500"> · {etaText}</span>
                            </p>
                          ) : (
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
                      </li>
                    );
                  })}
                </ul>
              </>
              )}
            </Card>
          )}
      </section>

      <section className="space-y-2" aria-labelledby="summary-purchases">
        <h2 id="summary-purchases" className="text-sm font-bold">
          Purchases{orders.data ? ` (${orderTotal})` : ""}
        </h2>
        {orders.isLoading ? (
          <Card className="p-6 text-sm text-neutral-500">Loading your orders…</Card>
        ) : orders.isError ? (
          <Card className="space-y-2 p-6 text-sm text-neutral-500">
            <p>{orders.error.message}</p>
            <Button size="sm" variant="outline" asChild>
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </Card>
        ) : orderRows.length === 0 ? (
          <Card className="space-y-2 p-10 text-center text-sm text-neutral-500">
            <p>No orders yet.</p>
            <Button size="sm" variant="outline" asChild>
              <Link href="/">Start shopping</Link>
            </Button>
          </Card>
        ) : (
          <Card className="px-6 py-2">
              <div className="flex flex-wrap items-center gap-2 border-b py-2.5">
                <Input
                  value={orderQ}
                  onChange={(e) => setOrderQ(e.target.value)}
                  placeholder="Search order numbers…"
                  aria-label="Search orders by number"
                  className="h-8 max-w-48 text-sm"
                />
                <Select value={orderSort} onValueChange={setOrderSort}>
                  <SelectTrigger size="sm" className="w-36" aria-label="Sort orders">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest first</SelectItem>
                    <SelectItem value="oldest">Oldest first</SelectItem>
                    <SelectItem value="total-desc">Total: high to low</SelectItem>
                    <SelectItem value="total-asc">Total: low to high</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap items-center gap-1">
                  <Button
                    size="sm"
                    variant={orderStatus === "all" ? "default" : "outline"}
                    aria-pressed={orderStatus === "all"}
                    className="h-8 rounded-full text-xs"
                    onClick={() => setOrderStatus("all")}
                  >
                    All
                  </Button>
                  {statuses.map(([s, count]) => (
                    <Button
                      key={s}
                      size="sm"
                      variant={orderStatus === s ? "default" : "outline"}
                      aria-pressed={orderStatus === s}
                      className="h-8 rounded-full text-xs"
                      onClick={() => setOrderStatus(orderStatus === s ? "all" : s)}
                    >
                      {s} ({count})
                    </Button>
                  ))}
                </div>
              </div>
              {filteredOrders.length === 0 ? (
                <div className="space-y-2 py-6 text-center text-sm text-neutral-500">
                  <p>No orders match these filters.</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setOrderQ("");
                      setOrderStatus("all");
                      setOrderSort("newest");
                    }}
                  >
                    Clear filters
                  </Button>
                </div>
              ) : (
                <ul className="divide-y">
                  {filteredOrders.map((o) => (
                  <li key={o.id}>
                    <Link href={`${base}/orders/${encodeURIComponent(o.number)}`} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-sm font-bold">{o.number}</p>
                        <p className="truncate text-xs text-neutral-500">
                          {o.items.reduce((a, i) => a + i.qty, 0)} items · {timeAgo(o.createdAt)}
                        </p>
                      </div>
                      <StatusBadge value={o.status} />
                      <span className="text-sm font-bold tabular-nums">{formatUSD(Number(o.total))}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              )}
            </Card>
          )}
      </section>
    </div>
  );
}
