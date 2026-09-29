import { db } from "@/lib/db";
import { getPagination, ok } from "@/lib/api/http";
import { withAdmin } from "@/lib/api/guard";

/** User directory: search + role/status filters, order volume per row. */
export const GET = withAdmin(async (req) => {
  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  const role = url.searchParams.get("role");
  const status = url.searchParams.get("status"); // active | suspended
  const { page, pageSize, skip } = getPagination(url);

  const where = {
    ...(q
      ? { OR: [{ email: { contains: q, mode: "insensitive" as const } }, { name: { contains: q, mode: "insensitive" as const } }] }
      : {}),
    ...(role ? { role: role as "BUYER" | "SELLER" | "ADMIN" } : {}),
    ...(status === "suspended" ? { suspendedAt: { not: null } } : status === "active" ? { suspendedAt: null } : {}),
  };
  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        suspendedAt: true,
        createdAt: true,
        _count: { select: { stores: true, disputes: true } },
      },
    }),
  ]);
  const ids = users.map((u) => u.id);
  const orderCounts = ids.length
    ? await db.order.groupBy({ by: ["buyerId"], where: { buyerId: { in: ids } }, _count: true })
    : [];
  const ordersByUser = new Map(orderCounts.map((o) => [o.buyerId, o._count]));
  return ok(
    users.map((u) => ({ ...u, orderCount: ordersByUser.get(u.id) ?? 0 })),
    { page, pageSize, total }
  );
});
