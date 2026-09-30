"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartItem = {
  slug: string;
  title: string;
  image: string;
  price: number;
  qty: number;
  variant?: string;
  /** Seller identity, captured at add time so the cart can group by store and
   *  show which parcel an item ships in. Advisory only — checkout re-resolves
   *  everything server-side. */
  storeId?: string;
  storeName?: string;
  storeSlug?: string;
  freeShipping?: boolean;
};

/** Minimal product shape any listing (mock or backend) can add to the cart. */
export type AddToCartInput = {
  slug: string;
  title: string;
  image: string;
  price: number;
  storeId?: string;
  storeName?: string;
  storeSlug?: string;
  freeShipping?: boolean;
};

type CartState = {
  items: CartItem[];
  couponCode: string | null;
  add: (p: AddToCartInput, qty?: number, variant?: string) => void;
  remove: (slug: string, variant?: string) => void;
  setQty: (slug: string, qty: number, variant?: string) => void;
  setCoupon: (code: string | null) => void;
  clear: () => void;
  count: () => number;
  subtotal: () => number;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      couponCode: null,
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
            items: [
              ...s.items,
              {
                slug: p.slug,
                title: p.title,
                image: p.image,
                price: p.price,
                qty,
                variant,
                ...(p.storeId ? { storeId: p.storeId } : {}),
                ...(p.storeName ? { storeName: p.storeName } : {}),
                ...(p.storeSlug ? { storeSlug: p.storeSlug } : {}),
                ...(typeof p.freeShipping === "boolean" ? { freeShipping: p.freeShipping } : {}),
              },
            ],
          };
        }),
      remove: (slug, variant) =>
        set((s) => ({ items: s.items.filter((i) => !(i.slug === slug && i.variant === variant)) })),
      setQty: (slug, qty, variant) =>
        set((s) => ({
          items: s.items.map((i) => (i.slug === slug && i.variant === variant ? { ...i, qty } : i)),
        })),
      setCoupon: (code) => set({ couponCode: code ? code.trim().toUpperCase() : null }),
      clear: () => set({ items: [], couponCode: null }),
      count: () => get().items.reduce((a, i) => a + i.qty, 0),
      subtotal: () => get().items.reduce((a, i) => a + i.qty * i.price, 0),
    }),
    { name: "ys-cart" }
  )
);
