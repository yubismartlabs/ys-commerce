import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";

/** Buyer's own order by number, with items + timeline. */
export async function GET(_req: Request, { params }: { params: Promise<{ number: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);
  const { number } = await params;

  const order = await db.order.findUnique({
    where: { number: decodeURIComponent(number) },
    include: { items: true, events: { orderBy: { createdAt: "asc" } }, shipments: { include: { store: { select: { id: true, name: true, slug: true } }, _count: { select: { items: true } } } } },
  });
  if (!order || order.buyerId !== userId) return fail("NOT_FOUND", "Order not found", 404);
  const stores = await db.store.findMany({
    where: { id: { in: [...new Set(order.items.map((i) => i.storeId))] } },
    select: { id: true, name: true, slug: true },
  });
  return ok({ ...order, stores });
}
