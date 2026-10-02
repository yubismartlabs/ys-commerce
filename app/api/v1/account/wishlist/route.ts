import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fail, getPagination, ok } from "@/lib/api/http";

/** Buyer's wishlist with live product rows. */
export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);

  const { page, pageSize, skip } = getPagination(new URL(req.url));
  const where = { userId };
  const [total, items] = await Promise.all([
    db.wishlistItem.count({ where }),
    db.wishlistItem.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        product: {
          select: {
            slug: true, title: true, image: true, price: true, compareAt: true,
            ratingAvg: true, ratingCount: true, soldCount: true, badge: true,
            freeShipping: true, status: true, category: true,
            variants: { select: { stock: true } },
            // Needed so "add to cart" from the watchlist can group by seller,
            // and so the store link resolves to the canonical @handle.
            store: { select: { id: true, name: true, slug: true, username: true } },
          },
        },
      },
    }),
  ]);
  return ok(items, { page, pageSize, total });
}

const addSchema = z.object({
  slug: z.string().min(1).max(120),
  targetPrice: z.number().min(0.01).max(1000000).optional(),
});

/** Save an item; optional target price arms a price-drop alert. */
export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);

  const parsed = addSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION", "slug required", 422);

  const product = await db.product.findUnique({
    where: { slug: parsed.data.slug },
    select: { id: true, status: true, variants: { select: { stock: true } } },
  });
  if (!product || product.status !== "ACTIVE") return fail("NOT_FOUND", "Product not found", 404);

  const item = await db.wishlistItem.upsert({
    where: { userId_productId: { userId, productId: product.id } },
    update: { targetPrice: parsed.data.targetPrice ?? null },
    create: { userId, productId: product.id, targetPrice: parsed.data.targetPrice ?? null },
  });

  // Arm alerts: price target, or restock when currently unavailable.
  const outOfStock = product.variants.length > 0 && product.variants.every((v) => v.stock <= 0);
  if (parsed.data.targetPrice) {
    // Match on the whole set so a previously-fired alert is re-armed with the
    // new target instead of leaving a tombstoned row behind.
    const existing = await db.priceAlert.findFirst({
      where: { userId, productId: product.id, kind: "PRICE_DROP" },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      await db.priceAlert.update({
        where: { id: existing.id },
        data: { target: parsed.data.targetPrice, sentAt: null },
      });
    } else {
      await db.priceAlert.create({
        data: { userId, productId: product.id, kind: "PRICE_DROP", target: parsed.data.targetPrice },
      });
    }
  } else {
    // Clearing the target must actually disarm the alert. Previously the
    // WishlistItem target was nulled but the armed PriceAlert row survived, so
    // the buyer kept getting emails for a target they'd removed.
    await db.priceAlert.deleteMany({ where: { userId, productId: product.id, kind: "PRICE_DROP" } });
  }
  if (outOfStock) {
    const existing = await db.priceAlert.findFirst({
      where: { userId, productId: product.id, kind: "RESTOCK", sentAt: null },
    });
    if (!existing) {
      await db.priceAlert.create({ data: { userId, productId: product.id, kind: "RESTOCK" } });
    }
  }
  return ok(item, undefined, 201);
}

const bulkRemoveSchema = z.object({
  slugs: z.array(z.string().min(1).max(120)).min(1).max(50),
});

/**
 * Remove several items at once, for the multi-select on the summary list.
 * Rows only — same as the single-item DELETE, which likewise leaves any armed
 * price alerts alone rather than silently disarming something the buyer set.
 * Unknown slugs are ignored, so a retry after a partial success is a no-op
 * rather than an error.
 */
export async function DELETE(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);

  const parsed = bulkRemoveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION", "slugs[] (1-50) required", 422);

  const products = await db.product.findMany({
    where: { slug: { in: parsed.data.slugs } },
    select: { id: true },
  });
  const { count } = await db.wishlistItem.deleteMany({
    where: { userId, productId: { in: products.map((p) => p.id) } },
  });
  return ok({ removed: count });
}
