"use client";

import { useState } from "react";
import { BadgePercent, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCart } from "@/lib/store/cart";
import { useQuote, type CartLineInput } from "@/components/coupons/use-quote";

/**
 * Coupon apply/remove box. Totals are rendered by the parent via useQuote
 * with the same key (deduplicated by react-query, single request).
 */
export function CouponBox({ lines }: { lines: CartLineInput[] }) {
  const { couponCode, setCoupon } = useCart();
  const [draft, setDraft] = useState("");
  const quote = useQuote(lines, couponCode);

  if (!couponCode) {
    return (
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) setCoupon(draft);
          setDraft("");
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Coupon code"
          className="uppercase"
        />
        <Button type="submit" variant="outline" disabled={!draft.trim()}>
          Apply
        </Button>
      </form>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-1 font-mono text-[13px] font-bold text-emerald-700 dark:text-emerald-400">
          <BadgePercent className="size-4" /> {couponCode}
        </span>
        {quote.isLoading ? <Loader2 className="size-4 animate-spin text-neutral-400" /> : null}
        <Button variant="ghost" size="sm" className="ml-auto gap-1 text-neutral-500" onClick={() => setCoupon(null)}>
          <X className="size-3.5" /> Remove
        </Button>
      </div>
      {quote.data ? (
        <p className="text-xs text-emerald-600">{quote.data.summary} applied.</p>
      ) : quote.isError ? (
        <p className="text-xs text-red-600">{quote.error.message}</p>
      ) : null}
    </div>
  );
}
