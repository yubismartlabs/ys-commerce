import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";

/** Remove an item from the wishlist by product slug. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);
  const { slug } = await params;

  const product = await db.product.findUnique({ where: { slug: decodeURIComponent(slug) }, select: { id: true } });
  if (!product) return fail("NOT_FOUND", "Product not found", 404);
  await db.wishlistItem.deleteMany({ where: { userId, productId: product.id } });
  return ok({ removed: true });
}
