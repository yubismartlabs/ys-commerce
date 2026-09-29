import { db } from "@/lib/db";
import { fail, getPagination, ok } from "@/lib/api/http";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await db.store.findUnique({ where: { slug } });
  if (!store || store.status !== "APPROVED") return fail("NOT_FOUND", "Store not found", 404);

  const url = new URL(req.url);
  const { page, pageSize, skip } = getPagination(url);
  const where = { storeId: store.id, status: "ACTIVE" as const };
  const [total, products] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({ where, skip, take: pageSize, orderBy: { createdAt: "desc" } }),
  ]);
  return ok({ store, products }, { page, pageSize, total });
}
