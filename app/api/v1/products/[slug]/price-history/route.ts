import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";

/**
 * Buyer-visible price history for a product.
 *
 * Answers the question a markdown badge can't: was $45 ever the real price,
 * or is it invented? Only records where the price actually moved, so a long
 * tail of unchanged days doesn't pad the chart.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await db.product.findUnique({
    where: { slug },
    select: { id: true, status: true, price: true, compareAt: true },
  });
  if (!product || product.status !== "ACTIVE") return fail("NOT_FOUND", "Product not found", 404);

  const rows = await db.priceSnapshot.findMany({
    where: { productId: product.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { price: true, compareAt: true, source: true, createdAt: true },
  });

  const points = rows
    .map((r) => ({ price: Number(r.price), at: r.createdAt }))
    .reverse();

  const prices = points.map((p) => p.price);
  const low = prices.length ? Math.min(...prices) : null;
  const high = prices.length ? Math.max(...prices) : null;
  const current = points.length ? points[points.length - 1].price : Number(product.price);

  return ok({
    points,
    low,
    high,
    current,
    // Only worth showing when there's an actual movement to display.
    hasRange: low !== null && high !== null && high - low >= 0.01,
  });
}
