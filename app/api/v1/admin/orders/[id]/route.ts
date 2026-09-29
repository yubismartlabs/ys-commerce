import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { audit, withAdmin } from "@/lib/api/guard";
import { notifyOrderStatus } from "@/lib/notifications/notify";

const patchSchema = z.object({
  status: z.enum(["CANCELLED", "REFUNDED"]),
  note: z.string().max(500).optional(),
});

export const GET = withAdmin(
  async (_req, _actor, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const order = await db.order.findUnique({
      where: { id },
      include: { items: true, disputes: { include: { messages: true } } },
    });
    if (!order) return fail("NOT_FOUND", "Order not found", 404);
    return ok(order);
  }
);

export const PATCH = withAdmin(
  async (req, actor, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const parsed = patchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("VALIDATION", "status must be CANCELLED or REFUNDED", 422);

    const order = await db.order.findUnique({ where: { id } });
    if (!order) return fail("NOT_FOUND", "Order not found", 404);
    if (order.status === "REFUNDED") return fail("CONFLICT", "Order is already refunded", 409);

    // TODO(payments): trigger real refund against payment provider before writing REFUNDED
    const updated = await db.order.update({ where: { id }, data: { status: parsed.data.status } });
    await audit(actor.id, `order.${parsed.data.status.toLowerCase()}`, "Order", id, { note: parsed.data.note });

    // Notify buyer (in-app + email) and all admins. Never blocks the mutation.
    await notifyOrderStatus({
      orderId: id,
      orderNumber: order.number,
      buyerId: order.buyerId,
      status: parsed.data.status,
      note: parsed.data.note,
    });

    return ok(updated);
  }
);
