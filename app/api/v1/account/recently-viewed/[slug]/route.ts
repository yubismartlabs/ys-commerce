import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { ApiError } from "@/lib/api/guard";
import { requireUser } from "@/lib/api/identity";

/**
 * Remove one product from the buyer's history. Keyed by product slug, which is
 * what the card links to, so the client never has to hold a row id.
 *
 * 404 rather than 403 for someone else's history: a 403 would confirm the pair
 * exists, letting any signed-in buyer probe other people's browsing.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  let actor;
  try {
    actor = await requireUser();
  } catch (e) {
    if (e instanceof ApiError) return fail(e.code, e.message, e.status);
    throw e;
  }

  const { slug } = await params;
  const product = await db.product.findUnique({ where: { slug }, select: { id: true } });
  if (!product) return fail("NOT_FOUND", "Product not found.", 404);

  const { count } = await db.productView.deleteMany({
    where: { userId: actor.id, productId: product.id },
  });
  // Deleting something that was never in your history is a no-op, not a 404 —
  // the end state the caller asked for already holds.
  return ok({ removed: count });
}