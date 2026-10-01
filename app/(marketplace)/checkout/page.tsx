"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAccountUrl } from "@/lib/account-url";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/lib/store/cart";
import { CouponBox } from "@/components/coupons/coupon-box";
import { useQuote } from "@/components/coupons/use-quote";
import { useShippingQuote } from "@/components/cart/use-shipping-quote";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { formatUSD } from "@/lib/format";
import { displayVariantName } from "@/lib/products/variants";
import { useSavedAddresses } from "@/components/account/use-saved-addresses";
import {
  AddressFields,
  EMPTY_ADDRESS,
  isAddressComplete,
  type AddressFormValue,
} from "@/components/account/address-fields";
import { countryName } from "@/lib/addresses/countries";
import { formatAddressLines } from "@/lib/addresses/schema";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";

export default function CheckoutPage() {
  const a = useAccountUrl();
  const router = useRouter();
  const { items, subtotal, clear, couponCode } = useCart();
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // null = nothing chosen yet, so the default address applies. "new" = inline form.
  const [pickedChoice, setPickedChoice] = useState<string | null>(null);
  const [draft, setDraft] = useState<AddressFormValue>(EMPTY_ADDRESS);
  const [saveForLater, setSaveForLater] = useState(false);
  const hydrated = useHydrated();
  const saved = useSavedAddresses();
  const lines = items.map((i) => ({ slug: i.slug, qty: i.qty, ...(i.variant ? { variant: i.variant } : {}) }));
  const quote = useQuote(lines, couponCode);
  const shipping = useShippingQuote(lines);
  const total = subtotal();

  // Derived, not an effect: until the buyer actively picks something, the
  // default address (else the first) is what ships. Deriving means there is
  // no window where the Pay button is enabled with nothing selected.
  const defaultId = saved.rows.find((r) => r.isDefault)?.id ?? saved.rows[0]?.id ?? null;
  const choice = pickedChoice ?? defaultId;

  if (!hydrated) {
    return <Card className="h-72 animate-pulse bg-neutral-100 dark:bg-neutral-800" aria-label="Loading checkout" />;
  }
  if (items.length === 0) {
    return (
      <Card className="p-10 text-center">
        <h1 className="text-lg font-bold">Your cart is empty</h1>
        <p className="mt-1 text-sm text-neutral-500">Add something before checking out.</p>
        <Button asChild className="mt-4 bg-ali-red text-white hover:bg-ali-red-dark">
          <Link href="/">Start shopping</Link>
        </Button>
      </Card>
    );
  }

  // A saved row wins when one is picked; otherwise the inline form must be
  // complete. `usingInline` is true when there is nothing to pick (empty book)
  // as well as when the buyer chose it — otherwise a buyer with no saved
  // addresses would have no way to ever enable Pay.
  const picked = choice && choice !== "new" ? saved.rows.find((r) => r.id === choice) : undefined;
  const usingInline = saved.rows.length === 0 || choice === "new";
  const addressValid = !!picked || (usingInline && isAddressComplete(draft));

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
          ...(picked
            ? { addressId: picked.id }
            : {
                address: {
                  label: draft.label || null,
                  name: draft.name,
                  phone: draft.phone || null,
                  line1: draft.line1,
                  line2: draft.line2 || null,
                  city: draft.city,
                  region: draft.region || null,
                  postalCode: draft.postalCode,
                  country: draft.country,
                },
                ...(saveForLater ? { saveAddress: true } : {}),
              }),
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-bold">Shipping address</p>
            <Link href={`${a("/settings/addresses")}`} className="text-xs text-neutral-500 underline">
              Manage addresses
            </Link>
          </div>

          {saved.isLoading && saved.rows.length === 0 ? (
            <Skeleton className="h-24" />
          ) : saved.rows.length > 0 ? (
            <RadioGroup
              value={choice ?? ""}
              onValueChange={(v) => setPickedChoice(v)}
              className="gap-2"
              aria-label="Shipping address"
            >
              {saved.rows.map((r) => (
                <label
                  key={r.id}
                  htmlFor={`ship-${r.id}`}
                  className="flex cursor-pointer items-start gap-2 rounded-lg border border-neutral-200 p-2.5 text-sm has-checked:border-neutral-900 dark:border-neutral-700 dark:has-checked:border-white"
                >
                  <RadioGroupItem value={r.id} id={`ship-${r.id}`} className="mt-0.5" />
                  <span className="min-w-0">
                    <span className="font-semibold">{r.label || "Address"}</span>
                    {r.isDefault ? <span className="ml-1.5 text-xs text-neutral-500">Default</span> : null}
                    <br />
                    <span className="text-neutral-600">
                      {r.name} · {formatAddressLines(r).join(", ")} · {countryName(r.country)}
                    </span>
                  </span>
                </label>
              ))}
              <label
                htmlFor="ship-new"
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-200 p-2.5 text-sm font-semibold has-checked:border-neutral-900 dark:border-neutral-700 dark:has-checked:border-white"
              >
                <RadioGroupItem value="new" id="ship-new" />
                Use a different address
              </label>
            </RadioGroup>
          ) : null}

          {/* The inline form is the only option when the book is empty, and a
              deliberate choice otherwise. It is never removed from the DOM, so
              the label/name wiring the checkout tests drive stays stable. */}
          {usingInline ? (
            <div className="space-y-3">
              {saved.rows.length > 0 ? (
                <p className="text-xs font-semibold text-neutral-600">New address</p>
              ) : (
                <p className="text-xs text-neutral-500">
                  No saved addresses yet — enter where this order should ship.
                </p>
              )}
              <AddressFields
                value={draft}
                onChange={setDraft}
                idPrefix="co"
                showLabel={false}
              />
              {saved.rows.length > 0 ? null : (
                <label className="flex items-center gap-2 text-xs text-neutral-600">
                  <input
                    type="checkbox"
                    checked={saveForLater}
                    onChange={(e) => setSaveForLater(e.target.checked)}
                  />
                  Save this address to my account
                </label>
              )}
            </div>
          ) : null}
        </Card>
        <Card className="space-y-2 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold">Payment</p>
            <Badge variant="outline" className="text-[11px]">No charge in this environment</Badge>
          </div>
          <p className="text-sm text-neutral-600">
            This marketplace runs without a live payment processor. Placing an order records it as paid and
            no card is collected or charged. Wire up a provider before taking real money.
          </p>
        </Card>
      </div>
      <Card className="h-fit space-y-3 p-4">
        <h1 className="font-bold">Place order</h1>
        <ul className="space-y-1.5 text-sm">
          {items.map((i) => (
            <li key={i.slug + (i.variant ?? "")} className="flex justify-between gap-2">
              <span className="min-w-0 flex-1 truncate">{i.title}{i.variant ? ` · ${displayVariantName(i.variant)}` : ""} × {i.qty}</span>
              <span className="shrink-0 font-medium">{formatUSD(i.price * i.qty)}</span>
            </li>
          ))}
        </ul>
        <Separator />
        <div className="flex justify-between text-sm"><span>Items ({items.reduce((a, i) => a + i.qty, 0)})</span><span>{formatUSD(total)}</span></div>
        <CouponBox lines={lines} />
        {quote.data ? (
          <div className="flex justify-between text-sm text-emerald-600">
            <span>Coupon {quote.data.code}</span>
            <span>−{formatUSD(quote.data.discount + quote.data.shippingDiscount)}</span>
          </div>
        ) : null}
        {/* Split fulfilment: say how many parcels arrive, and what each costs. */}
        {shipping.data && shipping.data.byStore.length > 0 ? (
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>Shipping · {shipping.data.parcels} parcel{shipping.data.parcels === 1 ? "" : "s"}</span>
              <span>{shipping.data.shipping === 0 ? "Free" : formatUSD(shipping.data.shipping)}</span>
            </div>
            <ul className="space-y-0.5">
              {shipping.data.byStore.map((s) => (
                <li key={s.storeId} className="flex justify-between text-[11px] text-neutral-500">
                  <span className="truncate">{s.storeName}</span>
                  <span>{s.cost === 0 ? "Free" : formatUSD(s.cost)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="flex justify-between text-sm">
            <span>Shipping</span>
            <span className="text-neutral-500">Calculating…</span>
          </div>
        )}
        <Separator />
        <div className="flex justify-between font-extrabold">
          <span>Total</span>
          <span className="text-ali-red">
            {formatUSD(quote.data ? quote.data.total : total + (shipping.data?.shipping ?? 0))}
          </span>
        </div>
        {error ? <p className="text-sm text-red-600" role="alert">{error}</p> : null}
        <Button onClick={pay} disabled={placing || !addressValid} className="w-full bg-ali-red text-white hover:bg-ali-red-dark">
          {placing ? (<><Loader2 className="size-4 animate-spin" /> Placing order…</>) : "Pay now"}
        </Button>
        {!addressValid ? (
          <p className="text-xs text-neutral-500">Pick a shipping address to place the order.</p>
        ) : null}
        {!couponCode ? (
          <p className="text-xs text-neutral-500">Have a code? Apply it above — <Link href={a("/coupons")} className="underline">see active coupons</Link>.</p>
        ) : null}
      </Card>
    </div>
  );
}
