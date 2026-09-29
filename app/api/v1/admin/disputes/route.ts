import { db } from "@/lib/db";
import { getPagination, ok } from "@/lib/api/http";
import { withAdmin } from "@/lib/api/guard";

export const GET = withAdmin(async (req) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const { page, pageSize, skip } = getPagination(url);

  const where = status
    ? { status: status as "OPEN" | "UNDER_REVIEW" | "RESOLVED_BUYER" | "RESOLVED_SELLER" | "CLOSED" }
    : {};
  const [total, disputes] = await Promise.all([
    db.dispute.count({ where }),
    db.dispute.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        order: { select: { number: true, total: true } },
        buyer: { select: { email: true, name: true } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    }),
  ]);
  return ok(disputes, { page, pageSize, total });
});
