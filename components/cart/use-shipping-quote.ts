"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

export type CartLineInput = { slug: string; qty: number; variant?: string };

export type StoreShipping = { storeId: string; storeName: string; cost: number };

export type ShippingQuote = {
  subtotal: number;
  shipping: number;
  parcels: number;
  byStore: StoreShipping[];
};

/**
 * Live per-store shipping for the basket.
 *
 * With split fulfilment this is not decoration — a buyer needs to know they're
 * paying for three parcels before they place the order, and that a
 * free-shipping badge is actually honoured per seller.
 */
export function useShippingQuote(items: CartLineInput[]) {
  const encoded = useMemo(
    () =>
      items.length > 0
        ? encodeURIComponent(
            JSON.stringify(items.map((i) => ({ slug: i.slug, qty: i.qty, ...(i.variant ? { variant: i.variant } : {}) })))
          )
        : null,
    [items]
  );

  return useQuery({
    queryKey: ["cart-shipping", encoded],
    queryFn: async (): Promise<ShippingQuote> => {
      const res = await fetch(`/api/v1/cart/shipping?lines=${encoded}`);
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Couldn't price shipping.");
      return json.data as ShippingQuote;
    },
    enabled: !!encoded,
    retry: false,
    staleTime: 30_000,
  });
}
