import { db } from "@/lib/db";
import { getPagination, ok } from "@/lib/api/http";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  const category = url.searchParams.get("category");
  const { page, pageSize, skip } = getPagination(url);

  const where = {
    status: "ACTIVE" as const,
    ...(category ? { category } : {}),
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
}
