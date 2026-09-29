"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiProductCard } from "@/components/commerce/api-product-card";
import { useCart } from "@/lib/store/cart";
import { formatUSD } from "@/lib/format";

type Item = {
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
    variants: Array<{ stock: number }>;
  };
};

async function fetchWishlist(): Promise<Item[]> {
  const res = await fetch("/api/v1/account/wishlist?pageSize=50");
  if (res.status === 401) throw new Error("Sign in to see your wishlist.");
  if (!res.ok) throw new Error("Couldn't load wishlist.");
  return (await res.json()).data as Item[];
}

function TargetEditor({ item }: { item: Item }) {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState(item.targetPrice === null ? "" : String(item.targetPrice));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/account/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: item.product.slug,
          ...(target.trim() ? { targetPrice: Number(target) } : {}),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Save failed.");
      toast.success(target.trim() ? `Alert armed under $${Number(target).toFixed(2)}.` : "Price alert cleared.");
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex gap-1.5">
      <Input
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        placeholder="Alert under $"
        inputMode="decimal"
        className="h-8 text-xs"
      />
      <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" disabled={saving} onClick={save}>
        <Bell className="size-3.5" /> Alert
      </Button>
    </div>
  );
}

export default function WatchlistPage() {
  const queryClient = useQueryClient();
  const add = useCart((s) => s.add);
  const query = useQuery({ queryKey: ["wishlist"], queryFn: fetchWishlist, retry: false });
  const rows = query.data ?? [];

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
      <div className="space-y-3">
        <h1 className="text-xl font-bold">Watchlist</h1>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-800" />
          ))}
        </div>
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-bold">Watchlist</h1>
        <Card className="space-y-2 p-6 text-sm text-neutral-500">
          <p>{query.error.message}</p>
          <Button size="sm" variant="outline" asChild><Link href="/sign-in?next=/watchlist">Sign in</Link></Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Watchlist ({rows.length})</h1>
      {rows.length === 0 ? (
        <Card className="space-y-2 p-10 text-center text-sm text-neutral-500">
          <p>Nothing saved yet. Heart any product to watch its price.</p>
          <Button size="sm" asChild><Link href="/">Discover products</Link></Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((item) => {
            const out = item.product.variants.length > 0 && item.product.variants.every((v) => v.stock <= 0);
            return (
              <Card key={item.id} className="grid gap-3 p-3 sm:grid-cols-[140px_1fr]">
                <ApiProductCard product={{ ...item.product, price: Number(item.product.price), compareAt: item.product.compareAt === null ? null : Number(item.product.compareAt) }} />
                <div className="grid content-start gap-2">
                  {out ? (
                    <p className="text-xs font-bold text-amber-600">Out of stock — we&apos;ll email you when it&apos;s back.</p>
                  ) : (
                    <p className="text-xs text-neutral-500">Current: {formatUSD(Number(item.product.price))}</p>
                  )}
                  <TargetEditor item={item} />
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      className="h-8 gap-1 bg-ali-red text-xs text-white hover:bg-ali-red-dark"
                      disabled={out}
                      onClick={() => {
                        add({ slug: item.product.slug, title: item.product.title, image: item.product.image, price: Number(item.product.price) }, 1);
                        toast.success("Added to cart.");
                      }}
                    >
                      <ShoppingCart className="size-3.5" /> Add to cart
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs text-neutral-500" onClick={() => remove(item.product.slug)}>
                      <Trash2 className="size-3.5" /> Remove
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
