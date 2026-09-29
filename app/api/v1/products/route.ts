import { z } from "zod";
import { db } from "@/lib/db";
import { getPagination, ok, fail } from "@/lib/api/http";

const querySchema = z.object({
  q: z.string().max(120).optional(),
  category: z.string().max(60).optional(),
  minPrice: z.coerce.number().min(0).max(1000000).optional(),
  maxPrice: z.coerce.number().min(0).max(1000000).optional(),
  freeShipping: z.enum(["1", "true"]).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  badge: z.string().max(20).optional(),
  sort: z.enum(["newest", "price_asc", "price_desc", "rating", "sold"]).default("newest"),
});

const SORT: Record<string, object> = {
  newest: { createdAt: "desc" },
  price_asc: { price: "asc" },
  price_desc: { price: "desc" },
  rating: [{ ratingAvg: "desc" }, { ratingCount: "desc" }],
  sold: { soldCount: "desc" },
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsed.success) return fail("VALIDATION", "Invalid filters", 422);
  const f = parsed.data;
  const { page, pageSize, skip } = getPagination(url);

  const where = {
    status: "ACTIVE" as const,
    ...(f.category ? { category: f.category } : {}),
    ...(f.q ? { title: { contains: f.q, mode: "insensitive" as const } } : {}),
    ...(f.minPrice !== undefined || f.maxPrice !== undefined
      ? { price: { ...(f.minPrice !== undefined ? { gte: f.minPrice } : {}), ...(f.maxPrice !== undefined ? { lte: f.maxPrice } : {}) } }
      : {}),
    ...(f.freeShipping ? { freeShipping: true } : {}),
    ...(f.minRating ? { ratingAvg: { gte: f.minRating } } : {}),
    ...(f.badge ? { badge: f.badge } : {}),
  };
  const [total, products, categories] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: SORT[f.sort] as never,
      include: {
        store: { select: { name: true, slug: true } },
        variants: { select: { id: true, name: true, price: true, image: true, stock: true } },
      },
    }),
    db.product.groupBy({ by: ["category"], where: { status: "ACTIVE" }, _count: true }),
  ]);
  return ok(products, { page, pageSize, total }, 200, {
    categories: categories.map((c) => ({ category: c.category, count: c._count })),
  });
}
