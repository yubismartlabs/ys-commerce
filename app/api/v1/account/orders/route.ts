import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getPagination, ok, fail } from "@/lib/api/http";

/** Signed-in buyer's own orders (items included for counts). */
export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);

  const url = new URL(req.url);
  const { page, pageSize, skip } = getPagination(url);
  const where = { buyerId: userId };
  const [total, orders] = await Promise.all([
    db.order.count({ where }),
    db.order.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: { items: true },
    }),
  ]);
  return ok(orders, { page, pageSize, total });
}
