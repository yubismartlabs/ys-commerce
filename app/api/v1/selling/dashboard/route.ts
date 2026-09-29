import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";

/** Real seller dashboard: revenue, orders, rating, escrow, queues. */
export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);

  const url = new URL(req.url);
  const storeId = url.searchParams.get("storeId");
  const stores = await db.store.findMany({ where: { ownerId: userId } });
  if (stores.length === 0) {
    return ok({ stores: [], kpis: null, recentOrders: [], openDisputes: [], lowStock: [] });
  }
  const scopeIds = storeId ? stores.filter((s) => s.id === storeId).map((s) => s.id) : stores.map((s) => s.id);
  if (storeId && scopeIds.length === 0) return fail("NOT_FOUND", "Store not found", 404);

  const since = new Date(Date.now() - 30 * 86400000);
  const itemWhere = { storeId: { in: scopeIds } };
  const orderWhere = { items: { some: itemWhere } };
  const [
    orders,
    openDisputes,
    holds,
    lowStock,
    recentOrders,
    ratingAgg,
    listings,
  ] = await Promise.all([
    db.order.count({ where: { ...orderWhere, createdAt: { gte: since } } }),
    db.dispute.findMany({
      where: { status: { in: ["OPEN", "UNDER_REVIEW"] }, order: { items: { some: itemWhere } } },
      take: 5,
      orderBy: { createdAt: "desc" },
      select: { id: true, order: { select: { number: true } }, reason: true, status: true, createdAt: true },
    }),
    db.escrowHold.groupBy({
      by: ["status"],
      where: { storeId: { in: scopeIds } },
      _sum: { net: true },
    }),
    db.productVariant.findMany({
      where: { stock: { lte: 5 }, product: { storeId: { in: scopeIds }, status: "ACTIVE" } },
      take: 5,
      orderBy: { stock: "asc" },
      select: { id: true, name: true, stock: true, product: { select: { id: true, title: true } } },
    }),
    db.order.findMany({
      where: orderWhere,
      take: 8,
      orderBy: { createdAt: "desc" },
      select: { id: true, number: true, status: true, total: true, createdAt: true },
    }),
    db.review.aggregate({ where: { storeId: { in: scopeIds } }, _avg: { rating: true }, _count: true }),
    db.product.count({ where: { storeId: { in: scopeIds }, status: "ACTIVE" } }),
  ]);

  // Revenue needs qty multiplication — aggregate price*qty manually (bounded).
  const lines = await db.orderItem.findMany({
    where: { ...itemWhere, order: { status: { in: ["PAID", "SHIPPED", "DELIVERED"] }, createdAt: { gte: since } } },
    select: { price: true, qty: true },
  });
  const revenue30d = Math.round(lines.reduce((a, l) => a + Number(l.price) * l.qty, 0) * 100) / 100;

  const held = holds.filter((h) => h.status === "HELD").reduce((a, h) => a + Number(h._sum.net ?? 0), 0);
  const frozen = holds.filter((h) => h.status === "FROZEN").reduce((a, h) => a + Number(h._sum.net ?? 0), 0);

  return ok({
    stores: stores.map((s) => ({ id: s.id, name: s.name, slug: s.slug, status: s.status, ratingAvg: s.ratingAvg, followerCount: s.followerCount })),
    kpis: {
      revenue30d,
      orders30d: orders,
      ratingAvg: Math.round((ratingAgg._avg.rating ?? 0) * 10) / 10,
      ratingCount: ratingAgg._count,
      activeListings: listings,
      escrowHeld: Math.round(held * 100) / 100,
      escrowFrozen: Math.round(frozen * 100) / 100,
    },
    recentOrders,
    openDisputes,
    lowStock,
  });
}
