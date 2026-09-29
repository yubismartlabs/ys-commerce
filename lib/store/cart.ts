"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "@/lib/mocks/catalog";

export type CartItem = {
  slug: string;
  title: string;
  image: string;
  price: number;
  qty: number;
  variant?: string;
};

type CartState = {
  items: CartItem[];
  add: (p: Product, qty?: number, variant?: string) => void;
  remove: (slug: string) => void;
  setQty: (slug: string, qty: number) => void;
  clear: () => void;
  count: () => number;
  subtotal: () => number;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (p, qty = 1, variant) =>
        set((s) => {
          const found = s.items.find((i) => i.slug === p.slug && i.variant === variant);
          if (found) {
            return {
              items: s.items.map((i) =>
                i.slug === p.slug && i.variant === variant ? { ...i, qty: i.qty + qty } : i
              ),
            };
          }
          return {
            items: [...s.items, { slug: p.slug, title: p.title, image: p.image, price: p.price, qty, variant }],
          };
        }),
      remove: (slug) => set((s) => ({ items: s.items.filter((i) => i.slug !== slug) })),
      setQty: (slug, qty) =>
        set((s) => ({ items: s.items.map((i) => (i.slug === slug ? { ...i, qty } : i)) })),
      clear: () => set({ items: [] }),
      count: () => get().items.reduce((a, i) => a + i.qty, 0),
      subtotal: () => get().items.reduce((a, i) => a + i.qty * i.price, 0),
    }),
    { name: "ys-cart" }
  )
);
