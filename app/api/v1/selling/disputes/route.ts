import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getPagination, ok, fail } from "@/lib/api/http";

/** Disputes on orders containing the seller's items. */
export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);

  const stores = await db.store.findMany({ where: { ownerId: userId }, select: { id: true } });
  const storeIds = stores.map((s) => s.id);
  if (storeIds.length === 0) return ok([], { page: 1, pageSize: 20, total: 0 });

  const { page, pageSize, skip } = getPagination(new URL(req.url));
  const where = { order: { items: { some: { storeId: { in: storeIds } } } } };
  const [total, disputes] = await Promise.all([
    db.dispute.count({ where }),
    db.dispute.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        order: { select: { number: true, total: true, status: true } },
        buyer: { select: { email: true } },
      },
    }),
  ]);
  return ok(disputes, { page, pageSize, total });
}
