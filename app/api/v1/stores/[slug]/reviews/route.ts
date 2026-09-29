import { db } from "@/lib/db";
import { fail, getPagination, ok } from "@/lib/api/http";

/** All reviews across a store's products (for the store page tab). */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await db.store.findUnique({ where: { slug }, select: { id: true, status: true } });
  if (!store || store.status !== "APPROVED") return fail("NOT_FOUND", "Store not found", 404);

  const { page, pageSize, skip } = getPagination(new URL(req.url));
  const where = { storeId: store.id };
  const [total, reviews] = await Promise.all([
    db.review.count({ where }),
    db.review.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, rating: true, title: true, body: true, verified: true, helpful: true,
        replyBody: true, createdAt: true,
        author: { select: { name: true } },
        product: { select: { slug: true, title: true, image: true } },
      },
    }),
  ]);
  return ok(reviews, { page, pageSize, total });
}
