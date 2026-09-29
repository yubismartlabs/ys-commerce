import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";

/** Toggle a helpful vote (one per user, undoable). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in to vote", 401);
  const { id } = await params;

  const review = await db.review.findUnique({ where: { id }, select: { id: true, helpful: true } });
  if (!review) return fail("NOT_FOUND", "Review not found", 404);

  const existing = await db.reviewVote.findUnique({ where: { reviewId_userId: { reviewId: id, userId } } });
  if (existing) {
    await db.$transaction([
      db.reviewVote.delete({ where: { id: existing.id } }),
      db.review.update({ where: { id }, data: { helpful: Math.max(0, review.helpful - 1) } }),
    ]);
    return ok({ voted: false, helpful: Math.max(0, review.helpful - 1) });
  }
  await db.$transaction([
    db.reviewVote.create({ data: { reviewId: id, userId } }),
    db.review.update({ where: { id }, data: { helpful: review.helpful + 1 } }),
  ]);
  return ok({ voted: true, helpful: review.helpful + 1 });
}
