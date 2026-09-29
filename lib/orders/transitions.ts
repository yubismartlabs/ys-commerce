import { db } from "@/lib/db";
import { notifyOrderStatus } from "@/lib/notifications/notify";

export type OrderStatus = "PENDING" | "PAID" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED";

/** Legal status moves. Order-level only (no partial shipments). */
export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["PAID", "CANCELLED"],
  PAID: ["SHIPPED", "CANCELLED", "REFUNDED"],
  SHIPPED: ["SHIPPED", "DELIVERED", "REFUNDED"], // SHIPPED→SHIPPED = tracking-only update
  DELIVERED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

export class TransitionError extends Error {
  constructor(
    public code: "NOT_FOUND" | "INVALID" | "FORBIDDEN",
    message: string
  ) {
    super(message);
  }
}

export type TransitionInput = {
  orderId: string;
  to: Exclude<OrderStatus, "PENDING">; // nothing ever transitions back to PENDING
  actorId: string;
  /** Sellers may only move orders containing their own items. */
  sellerStoreIds?: string[];
  note?: string;
  trackingNumber?: string;
  carrier?: string;
};

/**
 * Move an order to a new status: validates the transition, stamps
 * shipped/delivered times, appends a timeline event and notifies
 * buyer + admins. Throws TransitionError (mapped to HTTP by callers).
 */
export async function transitionOrder(input: TransitionInput) {
  const order = await db.order.findUnique({
    where: { id: input.orderId },
    include: { items: { select: { storeId: true } } },
  });
  if (!order) throw new TransitionError("NOT_FOUND", "Order not found");

  if (input.sellerStoreIds) {
    const involved = order.items.some((i) => input.sellerStoreIds!.includes(i.storeId));
    if (!involved) throw new TransitionError("FORBIDDEN", "This order has none of your items");
  }

  const from = order.status as OrderStatus;
  if (!TRANSITIONS[from].includes(input.to)) {
    throw new TransitionError("INVALID", `Cannot move order from ${from} to ${input.to}`);
  }
  const trackingOnly = from === "SHIPPED" && input.to === "SHIPPED";

  const data: Record<string, unknown> = { status: input.to };
  if (input.to === "SHIPPED") {
    if (input.trackingNumber !== undefined) data.trackingNumber = input.trackingNumber || null;
    if (input.carrier !== undefined) data.carrier = input.carrier || null;
    if (!trackingOnly) data.shippedAt = new Date();
  }
  if (input.to === "DELIVERED") data.deliveredAt = new Date();

  const updated = await db.$transaction(async (tx) => {
    const o = await tx.order.update({ where: { id: input.orderId }, data: data as never });
    await tx.orderEvent.create({
      data: {
        orderId: input.orderId,
        type: trackingOnly ? "NOTE" : (input.to as never),
        message:
          input.note ??
          (trackingOnly
            ? `Tracking updated${input.trackingNumber ? `: ${input.trackingNumber}` : ""}`
            : undefined),
        actorId: input.actorId,
      },
    });
    return o;
  });

  // Buyer + admin fan-out (in-app + email). Never blocks the mutation.
  const full = await db.order.findUnique({ where: { id: input.orderId } });
  if (full) {
    await notifyOrderStatus({
      orderId: full.id,
      orderNumber: full.number,
      buyerId: full.buyerId,
      status: input.to,
      note: input.note,
      trackingNumber: full.trackingNumber ?? undefined,
      carrier: full.carrier ?? undefined,
    });
  }
  return updated;
}

/** Append an internal timeline note without changing status. */
export async function addOrderNote(orderId: string, actorId: string, message: string) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) throw new TransitionError("NOT_FOUND", "Order not found");
  return db.orderEvent.create({ data: { orderId, type: "NOTE", message, actorId } });
}
