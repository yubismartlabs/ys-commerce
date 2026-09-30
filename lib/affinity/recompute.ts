import { db } from "@/lib/db";

/**
 * Frequently-bought-together from real baskets.
 *
 * Self-join on orderId pairs lines from the same (non-cancelled) order;
 * both directions are stored so reads are a single indexed lookup on aId.
 * Full rebuild each run (delete + insert) keeps it idempotent and simple —
 * at marketplace scale this wants incremental upserts, but a 2000-row cap
 * keeps the nightly-shape job trivially cheap today.
 */
export async function runAffinity(): Promise<{ pairs: number }> {
  const rows = await db.$queryRaw<Array<{ a: string; b: string; c: bigint }>>`
    SELECT l1."productId" AS a, l2."productId" AS b, COUNT(DISTINCT l1."orderId")::int AS c
    FROM "OrderItem" l1
    JOIN "OrderItem" l2 ON l2."orderId" = l1."orderId" AND l2."productId" <> l1."productId"
    JOIN "Order" o ON o."id" = l1."orderId" AND o."status" NOT IN ('CANCELLED', 'REFUNDED')
    JOIN "Product" p1 ON p1."id" = l1."productId" AND p1."status" = 'ACTIVE'
    JOIN "Product" p2 ON p2."id" = l2."productId" AND p2."status" = 'ACTIVE'
    GROUP BY l1."productId", l2."productId"
    ORDER BY c DESC
    LIMIT 2000
  `;

  await db.productAffinity.deleteMany();
  if (rows.length > 0) {
    await db.productAffinity.createMany({
      data: rows.map((r) => ({ aId: r.a, bId: r.b, count: Number(r.c) })),
    });
  }
  return { pairs: rows.length };
}

/** Top companions for a product, with live card fields for citations. */
export async function pairsFor(productId: string, take = 4) {
  const affs = await db.productAffinity.findMany({
    where: { aId: productId },
    orderBy: { count: "desc" },
    select: { bId: true, count: true },
    take,
  });
  if (affs.length === 0) return [];
  const products = await db.product.findMany({
    where: { id: { in: affs.map((a) => a.bId) }, status: "ACTIVE" },
    select: {
      id: true, slug: true, title: true, price: true, compareAt: true, image: true,
      ratingAvg: true, ratingCount: true, soldCount: true, badge: true,
      freeShipping: true, brand: true, category: true,
      store: { select: { id: true, name: true, slug: true } },
    },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  return affs.flatMap((a) => {
    const p = byId.get(a.bId);
    return p ? [{ product: p, count: a.count }] : [];
  });
}
