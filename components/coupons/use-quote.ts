"use client";

import { useQuery } from "@tanstack/react-query";

export type CartLineInput = { slug: string; qty: number; variant?: string };

export type Quote = {
  code: string;
  type: "PERCENT" | "FIXED" | "FREESHIP";
  summary: string;
  subtotal: number;
  discount: number;
  shipping: number;
  shippingDiscount: number;
  shippingFinal: number;
  total: number;
};

async function fetchQuote(items: CartLineInput[], code: string): Promise<Quote> {
  const res = await fetch("/api/v1/coupons/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, items }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message ?? "Coupon invalid.");
  return json.data as Quote;
}

/** Live server-side quote for the applied coupon. Disabled without a code. */
export function useQuote(items: CartLineInput[], code: string | null) {
  return useQuery({
    queryKey: ["coupon-quote", code, items],
    queryFn: () => fetchQuote(items, code!),
    enabled: items.length > 0 && !!code,
    retry: false,
    staleTime: 30_000,
  });
}
