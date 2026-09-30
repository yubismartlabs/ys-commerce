import { db } from "@/lib/db";
import { getSettingGroup } from "@/lib/server-settings";
import { notifyOrderStatus } from "@/lib/notifications/notify";

export type OrderStatus = "PENDING" | "PAID" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED";
export type ShipmentStatus = "PENDING" | "IN_TRANSIT" | "DELIVERED" | "CANCELLED" | "REFUNDED";

/** Legal order-level status moves. Terminal states have no exits. */
export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["PAID", "CANCELLED"],
  PAID: ["SHIPPED", "CANCELLED", "REFUNDED"],
  SHIPPED: ["SHIPPED", "DELIVERED", "REFUNDED"], // SHIPPED→SHIPPED = tracking-only update
  DELIVERED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

/**
 * Derive the order's aggregate status from its parcels.
 *
 * A multi-seller basket is N separate parcels, so "SHIPPED" now means "every
 * parcel is in transit" and "DELIVERED" means "every parcel arrived". A single
 * undelivered parcel holds the whole order at SHIPPED — which is what a buyer
 * means by it.
 */
export function aggregateOrderStatus(shipments: Array<{ status: ShipmentStatus }>): OrderStatus {
  const live = shipments.filter((s) => s.status !== "CANCELLED");
  if (live.length === 0) return "CANCELLED";
  if (live.every((s) => s.status === "DELIVERED")) return "DELIVERED";
  if (live.every((s) => s.status === "IN_TRANSIT" || s.status === "DELIVERED")) return "SHIPPED";
  return "PAID";
}

/** Order is fully refunded only when every parcel has been refunded. */
export function allRefunded(shipments: Array<{ status: ShipmentStatus }>): boolean {
  return shipments.length > 0 && shipments.every((s) => s.status === "REFUNDED" || s.status === "CANCELLED");
}

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
  to: Exclude<OrderStatus, "PENDING">;
  actorId: string;
  /** Sellers may only move their OWN parcels. Admins omit this. */
  sellerStoreIds?: string[];
  note?: string;
  trackingNumber?: string;
  carrier?: string;
};

/**
 * Advance an order's fulfilment.
 *
 * When `sellerStoreIds` is supplied the transition is scoped to that seller's
 * parcels only — a seller shipping their half of a two-seller order must not
 * mark the other seller's parcel as delivered. Omitted (admin), every parcel
 * moves.
 */
export async function transitionOrder(input: TransitionInput) {
  const order = await db.order.findUnique({
    where: { id: input.orderId },
    include: { shipments: { select: { id: true, storeId: true, status: true } } },
  });
  if (!order) throw new TransitionError("NOT_FOUND", "Order not found");

  const scoped = input.sellerStoreIds
    ? order.shipments.filter((s) => input.sellerStoreIds!.includes(s.storeId))
    : order.shipments;
  if (input.sellerStoreIds && scoped.length === 0) {
    throw new TransitionError("FORBIDDEN", "This order has none of your items");
  }

  const from = order.status as OrderStatus;
  if (!TRANSITIONS[from].includes(input.to)) {
    throw new TransitionError("INVALID", `Cannot move order from ${from} to ${input.to}`);
  }
  const trackingOnly = from === "SHIPPED" && input.to === "SHIPPED";

  // Recompute the order's aggregate status from ALL parcels afterwards, so a
  // seller marking their parcel delivered can't wrongly deliver a peer's.
  const allAfter: Array<{ status: ShipmentStatus }> = order.shipments.map((s) => {
    const moved = scoped.some((t) => t.id === s.id);
    if (!moved) return { status: s.status };
    const next = shipmentStatusFor(input.to);
    return next === "PENDING" ? { status: s.status } : { status: next };
  });

  let nextStatus: OrderStatus = input.to;
  if (input.to === "SHIPPED" || input.to === "DELIVERED" || input.to === "CANCELLED") {
    nextStatus = aggregateOrderStatus(allAfter);
  } else if (input.to === "REFUNDED" && allRefunded(allAfter)) {
    nextStatus = "REFUNDED";
  }

  const now = new Date();
  const shipmentData: Record<string, unknown> = { status: shipmentStatusFor(input.to) };
  if (input.to === "SHIPPED") {
    if (input.trackingNumber !== undefined) shipmentData.trackingNumber = input.trackingNumber || null;
    if (input.carrier !== undefined) shipmentData.carrier = input.carrier || null;
    if (!trackingOnly) shipmentData.shippedAt = now;
  }
  if (input.to === "DELIVERED") shipmentData.deliveredAt = now;

  const orderData: Record<string, unknown> = { status: nextStatus };
  // Buyer protection starts once the LAST parcel lands.
  if (nextStatus === "DELIVERED") {
    const commerce = await getSettingGroup("commerce");
    orderData.protectionUntil = new Date(now.getTime() + commerce.buyerProtectionDays * 86400000);
  }

  const updated = await db.$transaction(async (tx) => {
    for (const s of scoped) {
      await tx.shipment.update({ where: { id: s.id }, data: { ...shipmentData, updatedAt: now } as never });
    }
    const o = await tx.order.update({ where: { id: input.orderId }, data: orderData as never });
    await tx.orderEvent.create({
      data: {
        orderId: input.orderId,
        type: trackingOnly ? "NOTE" : (input.to as never),
        message:
          input.note ??
          (trackingOnly
            ? `Tracking updated${input.trackingNumber ? `: ${input.trackingNumber}` : ""}`
            : scoped.length < order.shipments.length
              ? `${scoped.length} of ${order.shipments.length} parcels ${labelFor(input.to).toLowerCase()}`
              : undefined),
        actorId: input.actorId,
      },
    });
    return o;
  });

  // Buyer + admin fan-out (in-app + email). Never blocks the mutation.
  const full = await db.order.findUnique({
    where: { id: input.orderId },
    include: { shipments: { select: { id: true, carrier: true, trackingNumber: true, status: true } } },
  });
  if (full) {
    const movingIds = new Set(scoped.map((s) => s.id));
  const moving = full.shipments.filter((s) => movingIds.has(s.id));
    await notifyOrderStatus({
      orderId: full.id,
      orderNumber: full.number,
      buyerId: full.buyerId,
      status: input.to,
      note: input.note,
      // With split parcels there is no single tracking number; summarise them.
      trackingNumber: summariseTracking(moving),
      carrier: moving[0]?.carrier ?? undefined,
    });
  }
  return updated;
}

function shipmentStatusFor(to: TransitionInput["to"]): ShipmentStatus {
  if (to === "SHIPPED") return "IN_TRANSIT";
  if (to === "DELIVERED") return "DELIVERED";
  if (to === "CANCELLED") return "CANCELLED";
  if (to === "REFUNDED") return "REFUNDED";
  return "PENDING";
}

function labelFor(to: TransitionInput["to"]): string {
  if (to === "SHIPPED") return "SHIPPED";
  if (to === "DELIVERED") return "DELIVERED";
  if (to === "CANCELLED") return "CANCELLED";
  if (to === "REFUNDED") return "REFUNDED";
  return "PAID";
}

/** "USPS 1Z999… (2 parcels)" — a buyer with a split shipment needs both numbers. */
export function summariseTracking(
  shipments: Array<{ carrier: string | null; trackingNumber: string | null }>
): string | undefined {
  const withTracking = shipments.filter((s) => s.trackingNumber);
  if (withTracking.length === 0) return undefined;
  if (withTracking.length === 1) return withTracking[0].trackingNumber ?? undefined;
  return `${withTracking.length} parcels: ${withTracking
    .map((s) => `${s.carrier ? `${s.carrier} ` : ""}${s.trackingNumber}`)
    .join(" · ")}`;
}

/** Append an internal timeline note without changing status. */
export async function addOrderNote(orderId: string, actorId: string, message: string) {
  const order = await db.order.findUnique({ where: { id: orderId }, select: { id: true } });
  if (!order) throw new TransitionError("NOT_FOUND", "Order not found");
  return db.orderEvent.create({ data: { orderId, type: "NOTE", message, actorId } });
}
