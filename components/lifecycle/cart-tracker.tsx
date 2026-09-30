"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useCart } from "@/lib/store/cart";

/** Mirror the signed-in buyer's cart for abandoned-cart recovery (debounced). */
export function CartTracker() {
  const { status } = useSession();
  const items = useCart((s) => s.items);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      // Include `variant` — without it a restored cart merged distinct
      // options of the same product into a single line.
      const lines = items.map((i) => ({
        slug: i.slug,
        title: i.title,
        image: i.image,
        price: i.price,
        qty: i.qty,
        ...(i.variant ? { variant: i.variant } : {}),
      }));
      fetch("/api/v1/account/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: lines }),
        keepalive: true,
      })
        .then((res) => {
          // Don't retry forever on a dead endpoint, and don't hide a real
          // server fault from the logs.
          if (!res.ok) console.warn("[cart-tracker] snapshot save failed:", res.status);
        })
        .catch((e) => console.warn("[cart-tracker] snapshot save failed:", e));
    }, 5000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [items, status]);

  return null;
}
