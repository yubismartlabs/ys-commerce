import { db } from "@/lib/db";

/** Recompute denormalized rating aggregates after review writes. */
export async function recalcProductRating(productId: string): Promise<{ avg: number; count: number }> {
  const agg = await db.review.aggregate({
    where: { productId },
    _avg: { rating: true },
    _count: true,
  });
  const count = agg._count;
  const avg = Math.round(((agg._avg.rating ?? 0) * 10)) / 10;
  await db.product.update({ where: { id: productId }, data: { ratingAvg: avg, ratingCount: count } });
  return { avg, count };
}

/** 1–5 star distribution for the breakdown bars. */
export async function ratingDistribution(productId: string): Promise<Array<{ rating: number; count: number }>> {
  const groups = await db.review.groupBy({
    by: ["rating"],
    where: { productId },
    _count: true,
  });
  const byRating = new Map(groups.map((g) => [g.rating, g._count]));
  return [5, 4, 3, 2, 1].map((rating) => ({ rating, count: byRating.get(rating) ?? 0 }));
}

/** Did this buyer purchase the product (verified badge)? */
export async function hasPurchased(userId: string, productId: string): Promise<boolean> {
  const hit = await db.orderItem.findFirst({
    where: { productId, order: { buyerId: userId, status: { in: ["PAID", "SHIPPED", "DELIVERED"] } } },
    select: { id: true },
  });
  return !!hit;
}

export type Spec = { k: string; v: string };

export function parseSpecs(value: unknown): Spec[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((s): s is Spec => !!s && typeof s === "object" && typeof (s as Spec).k === "string")
    .map((s) => ({ k: String(s.k).slice(0, 60), v: String((s as Spec).v ?? "").slice(0, 300) }))
    .filter((s) => s.k.trim().length > 0)
    .slice(0, 50);
}
