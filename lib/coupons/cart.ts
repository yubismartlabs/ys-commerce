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
};

/** Resolve storefront cart lines to live DB products (ACTIVE only, live prices). */
export async function resolveCart(
  lines: Array<{ slug: string; qty: number; variant?: string }>
): Promise<ResolvedLine[]> {
  const slugs = [...new Set(lines.map((l) => l.slug))];
  const products = await db.product.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true, title: true, image: true, price: true, category: true, status: true, storeId: true },
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
      storeId: p.storeId,
      category: p.category,
      price: dealPrice.get(p.id) ?? Number(p.price),
      qty: l.qty,
      title: p.title,
      image: p.image,
      variant: l.variant ?? null,
    };
  });
}

/** Standard shipping from settings: free at/above threshold, else flat fee. */
export async function standardShipping(subtotal: number): Promise<number> {
  const shipping = await getSettingGroup("shipping");
  return subtotal >= shipping.freeThreshold ? 0 : shipping.defaultFee;
}

export async function generateOrderNumber(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const n = `YS-${Math.floor(100000 + Math.random() * 900000)}`;
    const existing = await db.order.findUnique({ where: { number: n } });
    if (!existing) return n;
  }
  return `YS-${Date.now().toString().slice(-8)}`;
}
