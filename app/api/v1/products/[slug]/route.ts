import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await db.product.findUnique({
    where: { slug },
    include: {
      store: { select: { name: true, slug: true } },
      variants: true,
      reviews: { take: 10, orderBy: { createdAt: "desc" } },
    },
  });
  if (!product || product.status !== "ACTIVE") return fail("NOT_FOUND", "Product not found", 404);
  return ok(product);
}
