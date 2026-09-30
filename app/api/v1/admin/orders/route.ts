import { db } from "@/lib/db";
import { getPagination, ok } from "@/lib/api/http";
import { withAdmin } from "@/lib/api/guard";

export const GET = withAdmin(async (req) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const q = url.searchParams.get("q");
  const { page, pageSize, skip } = getPagination(url);

  const where = {
    ...(status
      ? { status: status as "PENDING" | "PAID" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED" }
      : {}),
    ...(q ? { number: { contains: q.toUpperCase(), mode: "insensitive" as const } } : {}),
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
  return ok(orders, { page, pageSize, total });
}, "orders");
