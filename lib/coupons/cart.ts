import { z } from "zod";
import { db } from "@/lib/db";
import { getSettingGroup } from "@/lib/server-settings";
import type { QuoteItem } from "@/lib/coupons/engine";

export const cartLineSchema = z.object({
  slug: z.string().min(1).max(120),
  qty: z.number().int().min(1).max(99),
  variant: z.string().max(80).optional(),
});

export type ResolvedLine = QuoteItem & {
  title: string;
  image: string;
  variant: string | null;
  productId: string;
  slug: string;
  freeShipping: boolean;
  /** null = product-level stock isn't tracked (unlimited). */
  trackStock: boolean;
  available: number | null;
};

/** Resolve storefront cart lines to live DB products (ACTIVE only, live prices). */
export async function resolveCart(
  lines: Array<{ slug: string; qty: number; variant?: string }>
): Promise<ResolvedLine[]> {
  const slugs = [...new Set(lines.map((l) => l.slug))];
  const products = await db.product.findMany({
    where: { slug: { in: slugs } },
    select: {
      id: true, slug: true, title: true, image: true, price: true, compareAt: true,
      category: true, status: true, storeId: true, freeShipping: true, trackStock: true, stock: true,
    },
  });
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  // Flash deals override the base price while live (window open, cap unmet).
  const now = new Date();
  const deals = await db.deal.findMany({
    where: { productId: { in: products.map((p) => p.id) }, status: "ACTIVE" },
  });
  const dealPrice = new Map(
    deals
      .filter((d) => d.startsAt <= now && d.endsAt > now && (d.stockCap === null || d.soldCount < d.stockCap))
      .map((d) => [d.productId, Number(d.dealPrice)])
  );
  return lines.map((l) => {
    const p = bySlug.get(l.slug);
    if (!p) throw new Error(`Product not found: ${l.slug}`);
    if (p.status !== "ACTIVE") throw new Error(`${p.title} is no longer available.`);
    return {
      productId: p.id,
      slug: p.slug,
      storeId: p.storeId,
      category: p.category,
      price: dealPrice.get(p.id) ?? Number(p.price),
      qty: l.qty,
      title: p.title,
      image: p.image,
      variant: l.variant ?? null,
      freeShipping: p.freeShipping,
      // Advisory availability so the cart can warn before checkout; the
      // authoritative check still runs inside the checkout transaction.
      trackStock: p.trackStock,
      available: p.trackStock ? p.stock : null,
    };
  });
}

/**
 * Shipping is charged per store, because each store ships its own parcel.
 *
 * `Product.freeShipping` is shown on the card, is a search facet and is
 * advertised on the product page — so it has to be true at the till. Within a
 * store: if every line is free-shipping that parcel is free, otherwise the
 * flat fee applies unless that store's share of the basket clears the global
 * free threshold.
 */
export type ShippingLine = { price: number; qty: number; freeShipping: boolean; storeId: string };

export type ShippingBreakdown = {
  /** Store id -> shipping charged for that store's parcel. */
  byStore: Map<string, number>;
  total: number;
};

export async function shippingForLines(lines: ShippingLine[]): Promise<ShippingBreakdown> {
  const shipping = await getSettingGroup("shipping");
  const byStore = new Map<string, number>();

  const groups = new Map<string, ShippingLine[]>();
  for (const l of lines) {
    const arr = groups.get(l.storeId) ?? [];
    arr.push(l);
    groups.set(l.storeId, arr);
  }

  for (const [storeId, storeLines] of groups) {
    byStore.set(storeId, storeParcelFee(storeLines, shipping));
  }

  return { byStore, total: round2([...byStore.values()].reduce((a, b) => a + b, 0)) };
}

/**
 * What one parcel costs: free when every line ships free, free once the
 * parcel clears the threshold, otherwise the flat fee. Pure so both the
 * basket quote and single-item estimates share one rule instead of two
 * copies that can drift.
 */
export function storeParcelFee(
  storeLines: ShippingLine[],
  shipping: { freeThreshold: number; defaultFee: number }
): number {
  const allFree = storeLines.every((l) => l.freeShipping);
  const subtotal = storeLines.reduce((a, l) => a + l.price * l.qty, 0);
  const fee = allFree ? 0 : subtotal >= shipping.freeThreshold ? 0 : shipping.defaultFee;
  return round2(fee);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function generateOrderNumber(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const n = `YS-${Math.floor(100000 + Math.random() * 900000)}`;
    const existing = await db.order.findUnique({ where: { number: n } });
    if (!existing) return n;
  }
  return `YS-${Date.now().toString().slice(-8)}`;
}
