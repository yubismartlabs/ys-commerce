import { z } from "zod";
import { db } from "@/lib/db";
import { getPagination, ok, fail, serialize } from "@/lib/api/http";
import { searchFacets, searchProducts, logSearch, type SearchFilters } from "@/lib/search/engine";
import { auth } from "@/auth";
import { NextResponse } from "next/server";

const querySchema = z.object({
  q: z.string().max(120).optional(),
  category: z.string().max(60).optional(),
  minPrice: z.coerce.number().min(0).max(1000000).optional(),
  maxPrice: z.coerce.number().min(0).max(1000000).optional(),
  freeShipping: z.enum(["1", "true"]).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  badge: z.string().max(20).optional(),
  deals: z.enum(["1", "true"]).optional(),
  sort: z.enum(["relevance", "newest", "price_asc", "price_desc", "rating", "sold"]).default("relevance"),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsed.success) return fail("VALIDATION", "Invalid filters", 422);
  const f = parsed.data;
  const { page, pageSize, skip } = getPagination(url);

  const filters: SearchFilters = {
    ...(f.category ? { category: f.category } : {}),
    ...(f.minPrice !== undefined ? { minPrice: f.minPrice } : {}),
    ...(f.maxPrice !== undefined ? { maxPrice: f.maxPrice } : {}),
    ...(f.freeShipping ? { freeShipping: true } : {}),
    ...(f.minRating ? { minRating: f.minRating } : {}),
    ...(f.badge ? { badge: f.badge } : {}),
    ...(f.deals ? { deals: true } : {}),
    sort: f.q ? f.sort : f.sort === "relevance" ? "newest" : f.sort,
  };

  const session = await auth().catch(() => null);
  const userId = session?.user?.id;

  if (!f.q?.trim()) {
    // Filtered browse (no query): Prisma path, newest default.
    const where = {
      status: "ACTIVE" as const,
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.minPrice !== undefined || filters.maxPrice !== undefined
        ? { price: { ...(filters.minPrice !== undefined ? { gte: filters.minPrice } : {}), ...(filters.maxPrice !== undefined ? { lte: filters.maxPrice } : {}) } }
        : {}),
      ...(filters.freeShipping ? { freeShipping: true } : {}),
      ...(filters.minRating ? { ratingAvg: { gte: filters.minRating } } : {}),
      ...(filters.badge ? { badge: filters.badge } : {}),
      ...(filters.deals
        ? { deals: { some: { status: "ACTIVE" as const, startsAt: { lte: new Date() }, endsAt: { gt: new Date() } } } }
        : {}),
    };
    const order =
      filters.sort === "price_asc" ? { price: "asc" as const }
      : filters.sort === "price_desc" ? { price: "desc" as const }
      : filters.sort === "rating" ? [{ ratingAvg: "desc" as const }, { ratingCount: "desc" as const }]
      : filters.sort === "sold" ? { soldCount: "desc" as const }
      : { createdAt: "desc" as const };
    const [total, products, categories] = await Promise.all([
      db.product.count({ where }),
      db.product.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: order,
        select: {
          id: true, slug: true, title: true, image: true, price: true, compareAt: true,
          ratingAvg: true, ratingCount: true, soldCount: true, badge: true, freeShipping: true,
        },
      }),
      db.product.groupBy({ by: ["category"], where: { status: "ACTIVE" }, _count: true }),
    ]);
    return NextResponse.json(
      serialize({
        data: products.map((p) => ({ ...p, rank: 0 })),
        pagination: { page, pageSize, total },
        meta: { categories: categories.map((c) => ({ category: c.category, count: c._count })), suggestion: [] },
      })
    );
  }

  const [{ hits, total, suggestion }, facets] = await Promise.all([
    searchProducts(f.q, filters, page, pageSize),
    searchFacets(f.q),
  ]);
  logSearch(f.q, total, userId ?? undefined);
  return ok(hits, { page, pageSize, total }, 200, {
    categories: facets.categories,
    priceMin: facets.priceMin,
    priceMax: facets.priceMax,
    suggestion,
  });
}
