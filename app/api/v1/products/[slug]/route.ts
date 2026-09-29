import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { parseSpecs, ratingDistribution } from "@/lib/products/ratings";
import { getActiveDeal } from "@/lib/deals/pricing";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await db.product.findUnique({
    where: { slug },
    include: {
      store: { select: { id: true, name: true, slug: true, status: true } },
      variants: { orderBy: { createdAt: "asc" } },
      reviews: {
        take: 3,
        orderBy: [{ helpful: "desc" }, { createdAt: "desc" }],
        select: { id: true, rating: true, title: true, body: true, verified: true, helpful: true, createdAt: true },
      },
    },
  });
  if (!product || product.status !== "ACTIVE") return fail("NOT_FOUND", "Product not found", 404);

  const [distribution, related, deal] = await Promise.all([
    ratingDistribution(product.id),
    db.product.findMany({
      where: { status: "ACTIVE", category: product.category, id: { not: product.id } },
      take: 10,
      orderBy: { soldCount: "desc" },
      select: {
        slug: true, title: true, image: true, price: true, compareAt: true,
        ratingAvg: true, ratingCount: true, soldCount: true, badge: true, freeShipping: true,
      },
    }),
    getActiveDeal(product.id),
  ]);

  const session = await auth();
  const mine = session?.user?.id
    ? await db.review.findUnique({
        where: { productId_authorId: { productId: product.id, authorId: session.user.id } },
        select: { id: true },
      })
    : null;
  const wished = session?.user?.id
    ? await db.wishlistItem.findUnique({
        where: { userId_productId: { userId: session.user.id, productId: product.id } },
        select: { id: true },
      })
    : null;

  return ok({
    ...product,
    specs: parseSpecs(product.specs),
    distribution,
    related,
    deal: deal ? { ...deal, dealPrice: Number(deal.dealPrice) } : null,
    viewer: { reviewed: !!mine, wishlisted: !!wished },
  });
}
