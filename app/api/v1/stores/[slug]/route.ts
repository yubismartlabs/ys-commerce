import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fail, getPagination, ok } from "@/lib/api/http";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await db.store.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      logo: true,
      banner: true,
      shippingPolicy: true,
      returnPolicy: true,
      announcement: true,
      status: true,
      ratingAvg: true,
      ratingCount: true,
      soldCount: true,
      followerCount: true,
      createdAt: true,
    },
  });
  if (!store || store.status !== "APPROVED") return fail("NOT_FOUND", "Store not found", 404);

  const url = new URL(req.url);
  const category = url.searchParams.get("category");
  const sort = url.searchParams.get("sort") === "sold" ? { soldCount: "desc" as const } : { createdAt: "desc" as const };
  const { page, pageSize, skip } = getPagination(url);
  const where = {
    storeId: store.id,
    status: "ACTIVE" as const,
    ...(category ? { category } : {}),
  };
  const [total, products, categories] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: sort,
      select: {
        slug: true, title: true, image: true, price: true, compareAt: true,
        ratingAvg: true, ratingCount: true, soldCount: true, badge: true, freeShipping: true,
      },
    }),
    db.product.groupBy({ by: ["category"], where: { storeId: store.id, status: "ACTIVE" }, _count: true }),
  ]);

  const session = await auth();
  let following = false;
  if (session?.user?.id) {
    const f = await db.storeFollow.findUnique({
      where: { storeId_userId: { storeId: store.id, userId: session.user.id } },
      select: { id: true },
    });
    following = !!f;
  }
  return ok({ store, products, following }, { page, pageSize, total }, 200, {
    categories: categories.map((c) => ({ category: c.category, count: c._count })),
  });
}
