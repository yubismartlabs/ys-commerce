import { db } from "@/lib/db";
import { safeImageList, safeImageSrc } from "@/lib/images";
import { normalizeCategory } from "@/lib/categories";
import type { ApiCardRow } from "@/components/commerce/api-product-card";
import type { CardProduct } from "@/components/commerce/product-card";

/**
 * Server-side product feed. Used by SSR pages (home) so the first paint ships
 * real products instead of a client fetch waterfall.
 *
 * These queries bypass `serialize()`, so image URLs MUST be run through
 * `safeImageSrc` here — otherwise an unconfigured host reaches `next/image`
 * and throws during render.
 */

const CARD_SELECT = {
  slug: true,
  title: true,
  image: true,
  price: true,
  compareAt: true,
  ratingAvg: true,
  ratingCount: true,
  soldCount: true,
  badge: true,
  freeShipping: true,
} as const;

export function toCard(row: {
  slug: string;
  title: string;
  image: string;
  price: { toNumber(): number } | string | number;
  compareAt?: { toNumber(): number } | string | number | null;
  ratingAvg: number;
  ratingCount: number;
  soldCount: number;
  badge?: string | null;
  freeShipping: boolean;
}): CardProduct {
  return {
    slug: row.slug,
    title: row.title,
    image: safeImageSrc(row.image),
    price: Number(row.price),
    compareAt:
      row.compareAt === null || row.compareAt === undefined || row.compareAt === ""
        ? undefined
        : Number(row.compareAt),
    rating: Number(row.ratingAvg),
    reviews: row.ratingCount,
    sold: row.soldCount,
    badge: row.badge,
    freeShipping: row.freeShipping,
  };
}

/** Active products ordered by units sold — the default "More to love" feed. */
export async function bestSellingProducts(take = 20): Promise<CardProduct[]> {
  const rows = await db.product.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ soldCount: "desc" }, { ratingAvg: "desc" }],
    take,
    select: CARD_SELECT,
  });
  return rows.map(toCard);
}

/** Newest active products. */
export async function newestProducts(take = 20): Promise<CardProduct[]> {
  const rows = await db.product.findMany({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take,
    select: CARD_SELECT,
  });
  return rows.map(toCard);
}

/** Category slug -> live product count, used for the home tiles. */
export async function categoryCounts(): Promise<Record<string, number>> {
  const grouped = await db.product.groupBy({
    by: ["category"],
    where: { status: "ACTIVE" },
    _count: { _all: true },
  });
  const out: Record<string, number> = {};
  for (const g of grouped) {
    const slug = normalizeCategory(g.category);
    if (slug) out[slug] = (out[slug] ?? 0) + g._count._all;
  }
  return out;
}

/** Other sellers' products in the same category, for the storefront side rail. */
export async function relatedProducts(productId: string, category: string, take = 8): Promise<CardProduct[]> {
  return (await relatedCardRows(productId, category, take)).map(toCard);
}

/**
 * Same as `relatedProducts` but in the API card-row shape, for components that
 * render `ApiProductCard` directly.
 */
export async function relatedCardRows(productId: string, category: string, take = 8): Promise<ApiCardRow[]> {
  const slug = normalizeCategory(category);
  const rows = await db.product.findMany({
    where: {
      status: "ACTIVE",
      id: { not: productId },
      ...(slug ? { category: { equals: slug, mode: "insensitive" } } : {}),
    },
    orderBy: { soldCount: "desc" },
    take,
    select: CARD_SELECT,
  });
  return rows.map((r) => ({
    slug: r.slug,
    title: r.title,
    image: safeImageSrc(r.image),
    price: Number(r.price),
    compareAt: r.compareAt === null || r.compareAt === undefined ? null : Number(r.compareAt),
    ratingAvg: Number(r.ratingAvg),
    ratingCount: r.ratingCount,
    soldCount: r.soldCount,
    badge: r.badge,
    freeShipping: r.freeShipping,
  }));
}

/** Re-export so server pages can sanitize image lists consistently. */
export { safeImageList, safeImageSrc };
