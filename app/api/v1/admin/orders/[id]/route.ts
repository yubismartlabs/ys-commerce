import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { audit, withAdmin } from "@/lib/api/guard";
import { addOrderNote, transitionOrder, TransitionError } from "@/lib/orders/transitions";

const patchSchema = z.object({
  status: z.enum(["PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"]).optional(),
  note: z.string().max(500).optional(),
  trackingNumber: z.string().max(80).optional(),
  carrier: z.string().max(60).optional(),
  // TODO(payments): trigger real refund against payment provider before writing REFUNDED
});

function transitionFail(e: unknown) {
  if (e instanceof TransitionError) {
    const status = e.code === "NOT_FOUND" ? 404 : e.code === "FORBIDDEN" ? 403 : 422;
    return fail(e.code, e.message, status);
  }
  throw e;
}

export const GET = withAdmin(
  async (_req, _actor, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const order = await db.order.findUnique({
      where: { id },
      include: {
        items: true,
        shipments: { include: { store: { select: { id: true, name: true, slug: true } }, _count: { select: { items: true } } } },
        returns: true,
        disputes: { include: { messages: true } },
        events: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!order) return fail("NOT_FOUND", "Order not found", 404);
    const buyer = await db.user.findUnique({
      where: { id: order.buyerId },
      select: { id: true, email: true, name: true },
    });
    return ok({ ...order, buyer });
  }
, "orders");

export const PATCH = withAdmin(
  async (req, actor, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const parsed = patchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("VALIDATION", "Invalid status transition payload", 422);
    const { status, note, trackingNumber, carrier } = parsed.data;
    if (status === "PENDING") return fail("VALIDATION", "Orders never transition back to PENDING", 422);

    try {
      if (status) {
        const updated = await transitionOrder({
          orderId: id,
          to: status,
          actorId: actor.id,
          note,
          trackingNumber,
          carrier,
        });
        await audit(actor.id, `order.${status.toLowerCase()}`, "Order", id, { note, trackingNumber });
        return ok(updated);
      }
      if (!note) return fail("VALIDATION", "Provide status and/or note", 422);
      const event = await addOrderNote(id, actor.id, note);
      await audit(actor.id, "order.note", "Order", id, {});
      return ok(event);
    } catch (e) {
      return transitionFail(e);
    }
  }
, "orders");
