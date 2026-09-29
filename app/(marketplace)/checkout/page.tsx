"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/lib/store/cart";
import { CouponBox } from "@/components/coupons/coupon-box";
import { useQuote } from "@/components/coupons/use-quote";
import { formatUSD } from "@/lib/format";

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, clear, couponCode } = useCart();
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");
  const lines = items.map((i) => ({ slug: i.slug, qty: i.qty, ...(i.variant ? { variant: i.variant } : {}) }));
  const quote = useQuote(lines, couponCode);
  const total = subtotal();
  const addressValid = name.trim() !== "" && street.trim() !== "" && city.trim() !== "" && zip.trim() !== "";

  if (items.length === 0) {
    return (
      <Card className="p-10 text-center">
        <p className="text-lg font-bold">Your cart is empty</p>
        <p className="mt-1 text-sm text-neutral-500">Add something before checking out.</p>
        <Button asChild className="mt-4 bg-ali-red text-white hover:bg-ali-red-dark">
          <Link href="/">Start shopping</Link>
        </Button>
      </Card>
    );
  }

  const pay = async () => {
    setPlacing(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines,
          ...(couponCode ? { couponCode } : {}),
          address: { name, phone: phone || undefined, street, city, zip },
        }),
      });
      const json = await res.json().catch(() => null);
      if (res.status === 401) {
        router.push("/sign-in?next=/checkout");
        return;
      }
      if (!res.ok) throw new Error(json?.error?.message ?? "Checkout failed.");
      const number = json.data.number as string;
      clear();
      toast.success(`Order ${number} placed.`);
      router.push(`/checkout/success?number=${encodeURIComponent(number)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed.");
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <Card className="space-y-3 p-4">
          <p className="font-bold">Shipping address (USD / US mock)</p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="co-name" className="text-xs font-semibold text-neutral-600">Full name *</label>
              <Input id="co-name" placeholder="Jane Doe" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label htmlFor="co-phone" className="text-xs font-semibold text-neutral-600">Phone</label>
              <Input id="co-phone" placeholder="(555) 123-4567" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label htmlFor="co-street" className="text-xs font-semibold text-neutral-600">Street *</label>
              <Input id="co-street" placeholder="123 Main St, Apt 4" autoComplete="street-address" value={street} onChange={(e) => setStreet(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label htmlFor="co-city" className="text-xs font-semibold text-neutral-600">City *</label>
              <Input id="co-city" placeholder="New York" autoComplete="address-level2" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label htmlFor="co-zip" className="text-xs font-semibold text-neutral-600">ZIP *</label>
              <Input id="co-zip" placeholder="10001" autoComplete="postal-code" value={zip} onChange={(e) => setZip(e.target.value)} />
            </div>
          </div>
        </Card>
        <Card className="space-y-2 p-4">
          <p className="font-bold">Payment (mock — no real charge)</p>
          <div className="grid gap-2 md:grid-cols-2">
            <Input placeholder="Card number" />
            <Input placeholder="MM / YY" />
          </div>
        </Card>
      </div>
      <Card className="h-fit space-y-3 p-4">
        <p className="font-bold">Place order</p>
        <ul className="space-y-1.5 text-sm">
          {items.map((i) => (
            <li key={i.slug + (i.variant ?? "")} className="flex justify-between gap-2">
              <span className="min-w-0 flex-1 truncate">{i.title}{i.variant ? ` · ${i.variant}` : ""} × {i.qty}</span>
              <span className="shrink-0 font-medium">{formatUSD(i.price * i.qty)}</span>
            </li>
          ))}
        </ul>
        <Separator />
        <div className="flex justify-between text-sm"><span>Items ({items.reduce((a, i) => a + i.qty, 0)})</span><span>{formatUSD(total)}</span></div>
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
        {error ? <p className="text-sm text-red-600" role="alert">{error}</p> : null}
        <Button onClick={pay} disabled={placing || !addressValid} className="w-full bg-ali-red text-white hover:bg-ali-red-dark">
          {placing ? (<><Loader2 className="size-4 animate-spin" /> Placing order…</>) : "Pay now"}
        </Button>
        {!addressValid ? (
          <p className="text-xs text-neutral-500">Enter your name, street, city, and ZIP to place the order.</p>
        ) : null}
        {!couponCode ? (
          <p className="text-xs text-neutral-500">Have a code? Apply it above — <Link href="/account" className="underline">see active coupons</Link>.</p>
        ) : null}
      </Card>
    </div>
  );
}
