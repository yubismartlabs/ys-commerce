import { db } from "@/lib/db";
import { getPagination, ok } from "@/lib/api/http";
import { withAdmin } from "@/lib/api/guard";

// Audit trail of outbound mail for the Email log page.
export const GET = withAdmin(async (req) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const { page, pageSize, skip } = getPagination(url);

  const where = status ? { status: status as "SENT" | "SKIPPED" | "FAILED" } : {};
  const [total, logs] = await Promise.all([
    db.emailLog.count({ where }),
    db.emailLog.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return ok(logs, { page, pageSize, total });
}, "emails");
