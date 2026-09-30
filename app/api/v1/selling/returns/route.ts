import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getPagination, ok, fail } from "@/lib/api/http";

/** Return requests against the seller's own stores. */
export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);

  const stores = await db.store.findMany({ where: { ownerId: userId }, select: { id: true } });
  const storeIds = stores.map((s) => s.id);
  if (storeIds.length === 0) return ok([], { page: 1, pageSize: 20, total: 0 });

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  const { page, pageSize, skip } = getPagination(url);
  const where = {
    storeId: { in: storeIds },
    ...(status ? { status: status as never } : {}),
  };
  const [total, returns] = await Promise.all([
    db.returnRequest.count({ where }),
    db.returnRequest.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        order: { select: { number: true, status: true } },
        buyer: { select: { email: true, name: true } },
        store: { select: { id: true, name: true, slug: true } },
      },
    }),
  ]);
  return ok(returns, { page, pageSize, total });
}
