import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { audit } from "@/lib/api/guard";
import { notifyUser } from "@/lib/notifications/notify";

const replySchema = z.object({ reply: z.string().min(1).max(1000) });

/** Seller replies to a review on their own product. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);
  const { id } = await params;

  const parsed = replySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION", "reply required", 422);

  const stores = await db.store.findMany({ where: { ownerId: userId }, select: { id: true } });
  const review = await db.review.findUnique({
    where: { id },
    select: { id: true, storeId: true, authorId: true, product: { select: { title: true, slug: true } } },
  });
  if (!review || !stores.some((s) => s.id === review.storeId)) {
    return fail("NOT_FOUND", "Review not found", 404);
  }
  const updated = await db.review.update({
    where: { id },
    data: { replyBody: parsed.data.reply, replyAt: new Date() },
  });
  await audit(userId, "review.reply", "Review", id, {});
  await notifyUser({
    userId: review.authorId,
    type: "review.replied",
    title: `Seller replied to your review of ${review.product.title}`,
    link: `/product/${review.product.slug}`,
    meta: { entityId: id },
  });
  return ok(updated);
}
