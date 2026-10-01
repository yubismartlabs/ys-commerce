import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { audit } from "@/lib/api/guard";
import { isSuspended } from "@/lib/api/identity";

/**
 * Selection-based bulk actions over existing listings.
 *
 * The other half of the inventory manager: import gets products in the door,
 * this keeps them maintained day to day.
 *
 * Prices are adjusted by MULTIPLIER and rounded to the nearest cent rather
 * than by a delta, so applying "-10%" twice is not the same as applying
 * "-10%" once — a bug that silently compounds for sellers using it as a
 * scheduled markdown tool.
 */

const actionSchema = z.object({
  storeId: z.string().min(1),
  productIds: z.array(z.string().min(1)).min(1, "Select at least one listing.").max(500),
  action: z.enum(["publish", "draft", "adjust_price", "set_stock"]),
  /** Percentage change, e.g. -10 or 15. Only for adjust_price. */
  percent: z
    .number({ message: "Enter a number, e.g. -10 or 15." })
    .min(-90, "A markdown can't be more than 90%.")
    .max(500, "That increase looks like a typo — max 500%.")
    .optional(),
  /** Absolute quantity. Only for set_stock. */
  stock: z
    .number({ message: "Enter the stock quantity to set." })
    .int("Stock must be a whole number.")
    .min(0, "Stock can't be negative.")
    .max(100000000, "That quantity looks like a typo.")
    .optional(),
});

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);
  if (await isSuspended(userId)) return fail("SUSPENDED", "This account is suspended", 403);

  const parsed = actionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail("VALIDATION", parsed.error.issues[0]?.message ?? "Invalid action", 422);
  }
  const { storeId, productIds, action, percent, stock } = parsed.data;

  const store = await db.store.findFirst({ where: { id: storeId, ownerId: userId }, select: { id: true } });
  if (!store) return fail("FORBIDDEN", "You don't own that store.", 403);

  if (action === "adjust_price" && (percent === undefined || percent === 0)) {
    return fail("VALIDATION", "Enter a percentage change, e.g. -10 or 15.", 422);
  }
  if (action === "set_stock" && stock === undefined) {
    return fail("VALIDATION", "Enter the stock quantity to set.", 422);
  }

  const products = await db.product.findMany({
    where: { id: { in: productIds }, storeId: store.id },
    select: { id: true, slug: true, title: true, price: true, stock: true, trackStock: true, status: true },
  });
  if (products.length === 0) {
    return fail("NOT_FOUND", "None of those listings are in this store.", 404);
  }

  const skipped: Array<{ slug: string; title: string; reason: string }> = [];
  const changed: Array<{ slug: string; title: string; detail: string }> = [];

  for (const p of products) {
    if (action === "publish" || action === "draft") {
      const target = action === "publish" ? "ACTIVE" : "DRAFT";
      if (p.status === "TAKEDOWN") {
        skipped.push({ slug: p.slug, title: p.title, reason: "Taken down by support — only support can restore it." });
        continue;
      }
      if (p.status === target) {
        skipped.push({ slug: p.slug, title: p.title, reason: `Already ${target}.` });
        continue;
      }
      await db.product.update({ where: { id: p.id }, data: { status: target } });
      changed.push({ slug: p.slug, title: p.title, detail: `status → ${target}` });
      continue;
    }

    if (action === "set_stock") {
      if (!p.trackStock) {
        skipped.push({ slug: p.slug, title: p.title, reason: "This listing doesn't track stock." });
        continue;
      }
      await db.$transaction([
        db.product.update({ where: { id: p.id }, data: { stock: stock! } }),
        db.productVariant.updateMany({ where: { productId: p.id, name: "Default" }, data: { stock: stock! } }),
      ]);
      changed.push({ slug: p.slug, title: p.title, detail: `stock ${p.stock} → ${stock}` });
      continue;
    }

    // adjust_price
    const next = round2(Number(p.price) * (1 + (percent as number) / 100));
    if (next < 0.01) {
      // Rounding a tiny price down lands on $0.00, which isn't a price. Say
      // what actually happened rather than "would make the price zero".
      skipped.push({
        slug: p.slug,
        title: p.title,
        reason: `A ${percent}% change on $${p.price} rounds to ${next < 0.01 ? "$0.00" : `$${next}`}. Set an explicit price instead.`,
      });
      continue;
    }
    await db.$transaction([
      db.product.update({ where: { id: p.id }, data: { price: next } }),
      // Keep the buyer-facing price history honest about bulk markdowns.
      db.priceSnapshot.create({ data: { productId: p.id, price: next, source: "bulk_adjust" } }),
    ]);
    changed.push({ slug: p.slug, title: p.title, detail: `${p.price} → ${next}` });
  }

  if (changed.length > 0) {
    await audit(userId, `product.bulk_${action}`, "Product", store.id, {
      storeId: store.id,
      requested: productIds.length,
      changed: changed.length,
      skipped: skipped.length,
      ...(percent !== undefined ? { percent } : {}),
      ...(stock !== undefined ? { stock } : {}),
    });
  }

  return ok({
    changed,
    changedCount: changed.length,
    skipped,
    skippedCount: skipped.length,
    /** Products the caller selected but which aren't in this store at all. */
    notFoundCount: productIds.length - products.length,
  });
}
