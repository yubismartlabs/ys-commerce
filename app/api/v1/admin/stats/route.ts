import { db } from "@/lib/db";
import { ok } from "@/lib/api/http";
import { withAdmin } from "@/lib/api/guard";

export const GET = withAdmin(async () => {
  const [vendors, orders, disputes, products, gmv] = await Promise.all([
    db.store.count(),
    db.order.count(),
    db.dispute.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
    db.product.count({ where: { status: "ACTIVE" } }),
    db.order.aggregate({
      _sum: { total: true },
      where: { status: { in: ["PAID", "SHIPPED", "DELIVERED"] } },
    }),
  ]);
  return ok({
    gmv30d: gmv._sum.total?.toNumber() ?? 0,
    vendors,
    orders,
    openDisputes: disputes,
    activeProducts: products,
    currency: "USD",
  });
}, "ops");
