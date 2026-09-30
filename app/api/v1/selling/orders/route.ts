import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getPagination, ok, fail, serialize } from "@/lib/api/http";
import { NextResponse } from "next/server";

async function sellerStoreIds(userId: string): Promise<string[]> {
  const stores = await db.store.findMany({ where: { ownerId: userId }, select: { id: true } });
  return stores.map((s) => s.id);
}

/**
 * Orders containing the seller's items. Each row carries sellerItems
 * (their lines only) + sellerSubtotal so multi-vendor orders stay clear.
 */
export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);

  const storeIds = await sellerStoreIds(userId);
  if (storeIds.length === 0) {
    return NextResponse.json(serialize({ data: [], pagination: { page: 1, pageSize: 20, total: 0 } }));
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const { page, pageSize, skip } = getPagination(url);
  const where = {
    items: { some: { storeId: { in: storeIds } } },
    ...(status ? { status: status as never } : {}),
  };
  const [total, orders] = await Promise.all([
    db.order.count({ where }),
    db.order.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: { items: true, shipments: { include: { store: { select: { id: true, name: true, slug: true } }, _count: { select: { items: true } } } } },
    }),
  ]);
  const rows = orders.map((o) => {
    const sellerItems = o.items.filter((i) => storeIds.includes(i.storeId));
    const sellerSubtotal = sellerItems.reduce((a, i) => a + Number(i.price) * i.qty, 0);
    return { ...o, sellerItems, sellerSubtotal: Math.round(sellerSubtotal * 100) / 100 };
  });
  return ok(rows, { page, pageSize, total });
}
