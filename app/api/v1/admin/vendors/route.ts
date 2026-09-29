import { db } from "@/lib/db";
import { getPagination, ok } from "@/lib/api/http";
import { withAdmin } from "@/lib/api/guard";

export const GET = withAdmin(async (req) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const { page, pageSize, skip } = getPagination(url);

  const where = status ? { status: status as "PENDING" | "APPROVED" | "SUSPENDED" | "REJECTED" } : {};
  const [total, vendors] = await Promise.all([
    db.store.count({ where }),
    db.store.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: { owner: { select: { email: true, name: true } }, _count: { select: { products: true } } },
    }),
  ]);
  return ok(vendors, { page, pageSize, total });
});
