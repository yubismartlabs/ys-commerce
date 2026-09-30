import { db } from "@/lib/db";
import { auth } from "@/auth";
import { fail, getPagination, ok } from "@/lib/api/http";
import { isSuspended } from "@/lib/api/identity";

/** Reviews the signed-in buyer has written, with the product they were left on. */
export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in to see your reviews", 401);
  if (await isSuspended(userId)) return fail("SUSPENDED", "This account is suspended", 403);

  const { page, pageSize, skip } = getPagination(new URL(req.url));
  const where = { authorId: userId };

  const [total, reviews] = await Promise.all([
    db.review.count({ where }),
    db.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        product: { select: { slug: true, title: true, image: true } },
        _count: { select: { votes: true } },
      },
    }),
  ]);

  return ok(reviews, { page, pageSize, total });
}
