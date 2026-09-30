"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/lib/store/cart";
import { CouponBox } from "@/components/coupons/coupon-box";
import { useQuote } from "@/components/coupons/use-quote";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { formatUSD } from "@/lib/format";

type SavedLine = {
  slug: string;
  title: string;
  image: string;
  price: number;
  qty: number;
  variant?: string;
};

export default function CartPage() {
  const { items, setQty, remove, subtotal, clear, couponCode } = useCart();
  const hydrated = useHydrated();
  const total = subtotal();
  const lines = items.map((i) => ({ slug: i.slug, qty: i.qty, ...(i.variant ? { variant: i.variant } : {}) }));
  const quote = useQuote(lines, couponCode);

  // Cart state is persisted to localStorage and only rehydrates after mount —
  // don't claim the cart is empty during SSR.
  if (!hydrated) {
    return <Card className="h-64 animate-pulse bg-neutral-100 dark:bg-neutral-800" aria-label="Loading cart" />;
  }

  if (items.length === 0) {
    return (
      <>
        <SavedCartBanner />
        <Card className="p-10 text-center">
          <h1 className="text-lg font-bold">Your cart is empty</h1>
          <p className="mt-1 text-sm text-neutral-500">Discover flash deals and Choice picks.</p>
          <Button asChild className="mt-4 bg-ali-red text-white hover:bg-ali-red-dark">
            <Link href="/">Start shopping</Link>
          </Button>
        </Card>
      </>
    );
  }

  return (
    <div className="space-y-4">
      <SavedCartBanner />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="divide-y p-0">
        {items.map((i) => (
          <div key={i.slug + (i.variant ?? "")} className="flex gap-3 p-4">
            <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
              <Image src={i.image} alt={i.title} fill sizes="80px" className="object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm">{i.title}</p>
              {i.variant ? <p className="text-xs text-neutral-500">{i.variant}</p> : null}
              <p className="mt-1 font-extrabold text-ali-red">{formatUSD(i.price)}</p>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex items-center rounded-full border">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Decrease quantity"
                    onClick={() =>
                      i.qty <= 1 ? remove(i.slug, i.variant) : setQty(i.slug, i.qty - 1, i.variant)
                    }
                  ><Minus /></Button>
                  <span className="w-6 text-center text-xs font-bold" aria-live="polite">{i.qty}</span>
                  <Button variant="ghost" size="icon-xs" aria-label="Increase quantity" onClick={() => setQty(i.slug, i.qty + 1, i.variant)}><Plus /></Button>
                </div>
                <Button variant="ghost" size="sm" onClick={() => remove(i.slug, i.variant)}><Trash2 className="size-4" /> Remove</Button>
              </div>
            </div>
          </div>
        ))}
        <div className="p-4">
          <Button variant="ghost" size="sm" onClick={clear}>Clear cart</Button>
        </div>
      </Card>
      <Card className="h-fit space-y-3 p-4">
        <h1 className="font-bold">Order summary</h1>
        <div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatUSD(total)}</span></div>
        <CouponBox lines={lines} />
        {quote.data ? (
          <>
            <div className="flex justify-between text-sm text-emerald-600"><span>Coupon {quote.data.code}</span><span>−{formatUSD(quote.data.discount + quote.data.shippingDiscount)}</span></div>
            <div className="flex justify-between text-sm"><span>Shipping</span><span>{quote.data.shippingFinal === 0 ? "Free" : formatUSD(quote.data.shippingFinal)}</span></div>
          </>
        ) : (
          <div className="flex justify-between text-sm"><span>Shipping</span><span className="text-neutral-500">At checkout</span></div>
        )}
        <Separator />
        <div className="flex justify-between font-extrabold"><span>Total</span><span className="text-ali-red">{formatUSD(quote.data ? quote.data.total : total)}</span></div>
        <Button asChild className="w-full bg-ali-red text-white hover:bg-ali-red-dark">
          <Link href="/checkout">Checkout</Link>
        </Button>
      </Card>
      </div>
    </div>
  );
}

/**
 * Offers to restore the cart saved for abandoned-cart recovery. Only rendered
 * when the live cart is empty, so it never competes with what the buyer is
 * actually doing. Lines that no longer resolve are dropped by the cart store
 * on the next checkout validation.
 */
function SavedCartBanner() {
  const { status } = useSession();
  const items = useCart((s) => s.items);
  const add = useCart((s) => s.add);
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState(false);

  const query = useQuery({
    queryKey: ["cart-snapshot"],
    queryFn: async (): Promise<SavedLine[]> => {
      const res = await fetch("/api/v1/account/cart");
      if (!res.ok) return [];
      const json = await res.json().catch(() => null);
      return Array.isArray(json?.data) ? (json.data as SavedLine[]) : [];
    },
    enabled: status === "authenticated" && items.length === 0 && !dismissed,
    staleTime: 30_000,
    retry: false,
  });

  const saved = query.data ?? [];
  if (status !== "authenticated" || dismissed || saved.length === 0) return null;

  const restore = () => {
    for (const line of saved) {
      add(
        { slug: line.slug, title: line.title, image: line.image, price: line.price },
        Math.max(1, line.qty),
        line.variant
      );
    }
    queryClient.invalidateQueries({ queryKey: ["cart-snapshot"] });
    toast.success(`Restored ${saved.length} item${saved.length === 1 ? "" : "s"}.`);
  };

  return (
    <Card className="flex flex-wrap items-center gap-3 border-amber-300 bg-amber-50 p-4 dark:bg-amber-950/30">
      <RotateCcw className="size-5 shrink-0 text-amber-600" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">You left {saved.length} item{saved.length === 1 ? "" : "s"} behind</p>
        <p className="truncate text-xs text-neutral-600">
          {saved.map((l) => l.title).join(", ")}
        </p>
      </div>
      <Button size="sm" onClick={restore} className="bg-ali-red text-white hover:bg-ali-red-dark">
        Restore cart
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>Dismiss</Button>
    </Card>
  );
}
