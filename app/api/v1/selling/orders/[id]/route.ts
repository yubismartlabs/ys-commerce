import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { audit } from "@/lib/api/guard";
import { transitionOrder, TransitionError } from "@/lib/orders/transitions";

async function sellerStoreIds(userId: string): Promise<string[]> {
  const stores = await db.store.findMany({ where: { ownerId: userId }, select: { id: true } });
  return stores.map((s) => s.id);
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);
  const { id } = await params;

  const storeIds = await sellerStoreIds(userId);
  const order = await db.order.findUnique({
    where: { id },
    include: { items: true, events: { orderBy: { createdAt: "asc" } } },
  });
  if (!order || !order.items.some((i) => storeIds.includes(i.storeId))) {
    return fail("NOT_FOUND", "Order not found", 404);
  }
  const sellerItems = order.items.filter((i) => storeIds.includes(i.storeId));
  return ok({ ...order, sellerItems });
}

const patchSchema = z.object({
  status: z.enum(["SHIPPED", "DELIVERED"]),
  trackingNumber: z.string().max(80).optional(),
  carrier: z.string().max(60).optional(),
  note: z.string().max(500).optional(),
});

/** Sellers advance fulfillment (ship/deliver) on orders with their items. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);
  const { id } = await params;

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION", "status must be SHIPPED or DELIVERED", 422);

  const storeIds = await sellerStoreIds(userId);
  if (storeIds.length === 0) return fail("FORBIDDEN", "No seller account", 403);
  try {
    const updated = await transitionOrder({
      orderId: id,
      to: parsed.data.status,
      actorId: userId,
      sellerStoreIds: storeIds,
      note: parsed.data.note,
      trackingNumber: parsed.data.trackingNumber,
      carrier: parsed.data.carrier,
    });
    await audit(userId, `order.${parsed.data.status.toLowerCase()}`, "Order", id, {
      via: "seller",
      trackingNumber: parsed.data.trackingNumber,
    });
    return ok(updated);
  } catch (e) {
    if (e instanceof TransitionError) {
      const status = e.code === "NOT_FOUND" ? 404 : e.code === "FORBIDDEN" ? 403 : 422;
      return fail(e.code, e.message, status);
    }
    throw e;
  }
}
