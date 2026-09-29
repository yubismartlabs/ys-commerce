import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fail, getPagination, ok } from "@/lib/api/http";
import { audit } from "@/lib/api/guard";
import { hasPurchased, recalcProductRating, recalcStoreRating } from "@/lib/products/ratings";
import { getEmailConfig } from "@/lib/email/send";
import { notifyUser } from "@/lib/notifications/notify";

const sortMap: Record<string, object> = {
  helpful: [{ helpful: "desc" }, { createdAt: "desc" }],
  recent: { createdAt: "desc" },
  highest: { rating: "desc" },
  lowest: { rating: "asc" },
};

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await db.product.findUnique({ where: { slug }, select: { id: true, status: true } });
  if (!product || product.status !== "ACTIVE") return fail("NOT_FOUND", "Product not found", 404);

  const url = new URL(req.url);
  const sort = sortMap[url.searchParams.get("sort") ?? "helpful"] ?? sortMap.helpful;
  const { page, pageSize, skip } = getPagination(url);
  const [total, reviews] = await Promise.all([
    db.review.count({ where: { productId: product.id } }),
    db.review.findMany({
      where: { productId: product.id },
      skip,
      take: pageSize,
      orderBy: sort as never,
      select: {
        id: true, rating: true, title: true, body: true, images: true,
        verified: true, helpful: true, replyBody: true, replyAt: true, createdAt: true,
        author: { select: { name: true } },
      },
    }),
  ]);

  const session = await auth();
  let voted: string[] = [];
  if (session?.user?.id && reviews.length > 0) {
    const votes = await db.reviewVote.findMany({
      where: { userId: session.user.id, reviewId: { in: reviews.map((r) => r.id) } },
      select: { reviewId: true },
    });
    voted = votes.map((v) => v.reviewId);
  }
  return ok(
    reviews.map((r) => ({ ...r, voted: voted.includes(r.id) })),
    { page, pageSize, total }
  );
}

const writeSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().max(120).optional(),
  body: z.string().max(2000).optional(),
  images: z.array(z.string().url().max(500)).max(6).default([]),
});

/** Verified buyers (and only once per product) may review. */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in to review", 401);

  const { slug } = await params;
  const parsed = writeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION", "rating 1-5 required", 422);

  const product = await db.product.findUnique({
    where: { slug },
    select: { id: true, status: true, title: true, storeId: true, store: { select: { ownerId: true, name: true } } },
  });
  if (!product || product.status !== "ACTIVE") return fail("NOT_FOUND", "Product not found", 404);
  if (!(await hasPurchased(userId, product.id))) {
    return fail("FORBIDDEN", "Only buyers who purchased this item can review", 403);
  }
  const existing = await db.review.findUnique({
    where: { productId_authorId: { productId: product.id, authorId: userId } },
  });
  if (existing) return fail("CONFLICT", "You already reviewed this product", 409);

  const review = await db.review.create({
    data: {
      productId: product.id,
      storeId: product.storeId,
      authorId: userId,
      rating: parsed.data.rating,
      title: parsed.data.title,
      body: parsed.data.body,
      images: parsed.data.images,
      verified: true,
    },
  });
  await recalcProductRating(product.id);
  await recalcStoreRating(product.storeId);
  await audit(userId, "review.create", "Review", review.id, { productId: product.id, rating: review.rating });

  // Seller gets an in-app + email nudge to respond.
  const config = await getEmailConfig();
  await notifyUser({
    userId: product.store.ownerId,
    type: "review.new",
    title: `New ${review.rating}★ review: ${product.title}`,
    link: `/selling/products/${product.id}`,
    meta: { entityId: review.id, rating: review.rating },
    email: {
      template: {
        subject: `[${config.siteName}] New ${review.rating}★ review`,
        html: `<p>${parsed.data.title ?? "New review"} — ${parsed.data.body ?? ""}</p>`,
        text: `${parsed.data.title ?? "New review"} — ${parsed.data.body ?? ""}`,
      },
      name: "review.new.seller",
      enabled: config.enabled && config.productEmails,
    },
  });
  return ok(review, undefined, 201);
}
