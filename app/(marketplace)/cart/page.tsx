"use client";

import Link from "next/link";
import Image from "next/image";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCart } from "@/lib/store/cart";
import { formatUSD } from "@/lib/format";

export default function CartPage() {
  const { items, setQty, remove, subtotal, clear } = useCart();
  const total = subtotal();

  if (items.length === 0) {
    return (
      <Card className="p-10 text-center">
        <p className="text-lg font-bold">Your cart is empty</p>
        <p className="mt-1 text-sm text-neutral-500">Discover flash deals and Choice picks.</p>
        <Button asChild className="mt-4 bg-ali-red text-white hover:bg-ali-red-dark">
          <Link href="/">Start shopping</Link>
        </Button>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card className="divide-y p-0">
        {items.map((i) => (
          <div key={i.slug + (i.variant ?? "")} className="flex gap-3 p-4">
            <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
              <Image src={i.image} alt={i.title} fill className="object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm">{i.title}</p>
              {i.variant ? <p className="text-xs text-neutral-500">{i.variant}</p> : null}
              <p className="mt-1 font-extrabold text-ali-red">{formatUSD(i.price)}</p>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex items-center rounded-full border">
                  <Button variant="ghost" size="icon-xs" onClick={() => setQty(i.slug, Math.max(1, i.qty - 1))}><Minus /></Button>
                  <span className="w-6 text-center text-xs font-bold">{i.qty}</span>
                  <Button variant="ghost" size="icon-xs" onClick={() => setQty(i.slug, i.qty + 1)}><Plus /></Button>
                </div>
                <Button variant="ghost" size="sm" onClick={() => remove(i.slug)}><Trash2 className="size-4" /> Remove</Button>
              </div>
            </div>
          </div>
        ))}
        <div className="p-4">
          <Button variant="ghost" size="sm" onClick={clear}>Clear cart</Button>
        </div>
      </Card>
      <Card className="h-fit space-y-3 p-4">
        <p className="font-bold">Order summary</p>
        <div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatUSD(total)}</span></div>
        <div className="flex justify-between text-sm"><span>Shipping</span><span className="text-emerald-600">Free</span></div>
        <div className="flex justify-between border-t pt-3 font-extrabold"><span>Total</span><span className="text-ali-red">{formatUSD(total)}</span></div>
        <Button asChild className="w-full bg-ali-red text-white hover:bg-ali-red-dark">
          <Link href="/checkout">Checkout</Link>
        </Button>
      </Card>
    </div>
  );
}
