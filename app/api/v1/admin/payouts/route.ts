import { db } from "@/lib/db";
import { getPagination, ok } from "@/lib/api/http";
import { withAdmin } from "@/lib/api/guard";

/** All payouts across stores for the admin ledger page. */
export const GET = withAdmin(async (req) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const { page, pageSize, skip } = getPagination(url);

  const where = status ? { status: status as "PENDING" | "PROCESSING" | "PAID" | "FAILED" } : {};
  const [total, payouts] = await Promise.all([
    db.payout.count({ where }),
    db.payout.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: { store: { select: { name: true, slug: true } } },
    }),
  ]);
  return ok(payouts, { page, pageSize, total });
}, "payouts");
