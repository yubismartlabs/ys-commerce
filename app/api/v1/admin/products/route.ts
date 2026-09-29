import { db } from "@/lib/db";
import { getPagination, ok } from "@/lib/api/http";
import { withAdmin } from "@/lib/api/guard";

export const GET = withAdmin(async (req) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const q = url.searchParams.get("q");
  const { page, pageSize, skip } = getPagination(url);

  const where = {
    ...(status ? { status: status as "DRAFT" | "ACTIVE" | "TAKEDOWN" } : {}),
    ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
  };
  const [total, products] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: { store: { select: { name: true, slug: true } } },
    }),
  ]);
  return ok(products, { page, pageSize, total });
});
