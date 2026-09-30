import { db } from "@/lib/db";
import { getSettingGroup } from "@/lib/server-settings";
import { filingEligibility } from "@/lib/escrow/escrow";

/**
 * Returns / RMA.
 *
 * Distinct from Dispute on purpose. A dispute is adversarial ("this seller
 * scammed me") and freezes the seller's escrow while it runs. A return is a
 * buyer exercising ordinary after-sales rights ("this doesn't fit, give me my
 * money back"). Forcing the second through the first inflates a seller's
 * dispute rate and freezes their funds for a non-accusatory request — which is
 * exactly how marketplaces lose good sellers.
 *
 * Money handling:
 *   REQUESTED / ACCEPTED / RECEIVED -> the covered lines' escrow holds freeze,
 *   so the seller can't be paid out for items that are coming back.
 *   REFUNDED  -> those holds go to REFUNDED and never accrue to a payout.
 *   REJECTED / CANCELLED -> holds unfreeze and resume normal release.
 */

export type ReturnLine = { orderItemId: string; qty: number; price: number; title: string };

export const RETURN_REASONS = [
  "NOT_AS_DESCRIBED",
  "DEFECTIVE",
  "WRONG_ITEM",
  "NO_LONGER_NEEDED",
  "BETTER_PRICE_ELSEWHERE",
  "DAMAGED_IN_TRANSIT",
  "OTHER",
] as const;

export type ReturnReason = (typeof RETURN_REASONS)[number];

export class ReturnError extends Error {
  constructor(
    public code: "NOT_FOUND" | "INVALID" | "FORBIDDEN" | "CONFLICT",
    message: string
  ) {
    super(message);
  }
}

/** Days after delivery during which a buyer can still open a return. */
async function returnWindowDays(): Promise<number> {
  // Buyer protection is the same clock the buyer already understands.
  const commerce = await getSettingGroup("commerce");
  return commerce.buyerProtectionDays;
}

/**
 * Create a return request. Partial returns are normal, so `lines` may cover
 * any subset of the order's items.
 */
export async function createReturn(input: {
  orderNumber: string;
  buyerId: string;
  reason: ReturnReason;
  note?: string;
  lines: Array<{ orderItemId: string; qty: number }>;
}) {
  const order = await db.order.findUnique({
    where: { number: input.orderNumber },
    include: {
      items: { include: { shipment: { select: { id: true, deliveredAt: true } } } },
      returns: { where: { status: { notIn: ["REFUNDED", "REJECTED", "CANCELLED"] } }, select: { items: true } },
    },
  });
  if (!order || order.buyerId !== input.buyerId) throw new ReturnError("NOT_FOUND", "Order not found.");
  if (order.status === "CANCELLED" || order.status === "REFUNDED") {
    throw new ReturnError("CONFLICT", "This order is closed.");
  }
  // Same eligibility gate as a dispute — a return shouldn't be a back door.
  const eligible = await filingEligibility(order.id, input.buyerId);
  if (!eligible.ok) throw new ReturnError("INVALID", eligible.error);

  if (input.lines.length === 0) throw new ReturnError("INVALID", "Select at least one item to return.");

  // Every return is per-seller; a request must not span stores.
  const byId = new Map(order.items.map((i) => [i.id, i]));
  const chosen = input.lines.map((l) => {
    const item = byId.get(l.orderItemId);
    if (!item) throw new ReturnError("INVALID", "Unknown item in this order.");
    if (l.qty < 1 || l.qty > item.qty) {
      throw new ReturnError("INVALID", `You can return between 1 and ${item.qty} of "${item.title}".`);
    }
    return item;
  });

  const storeIds = new Set(chosen.map((i) => i.storeId));
  if (storeIds.size > 1) {
    throw new ReturnError("INVALID", "Return each seller's items separately — they ship and refund separately.");
  }
  const storeId = chosen[0].storeId;

  // Don't let a second request double-claim the same units.
  const alreadyClaimed = new Map<string, number>();
  for (const r of order.returns) {
    for (const l of r.items as unknown as ReturnLine[]) {
      alreadyClaimed.set(l.orderItemId, (alreadyClaimed.get(l.orderItemId) ?? 0) + l.qty);
    }
  }
  for (const l of input.lines) {
    const item = byId.get(l.orderItemId)!;
    const used = alreadyClaimed.get(l.orderItemId) ?? 0;
    if (used + l.qty > item.qty) {
      throw new ReturnError("CONFLICT", `"${item.title}" already has a return in progress.`);
    }
  }

  const shipment = chosen[0].shipment ?? null;
  const request = await db.$transaction(async (tx) => {
    const created = await tx.returnRequest.create({
      data: {
        orderId: order.id,
        buyerId: input.buyerId,
        storeId,
        shipmentId: shipment?.id ?? null,
        reason: input.reason,
        note: input.note?.slice(0, 1000) ?? null,
        items: input.lines.map((l) => {
          const item = byId.get(l.orderItemId)!;
          return {
            orderItemId: l.orderItemId,
            qty: l.qty,
            price: Number(item.price),
            title: item.title,
          } satisfies ReturnLine;
        }),
      },
    });
    // Freeze the covered lines' escrow so they can't be paid out mid-return.
    await tx.escrowHold.updateMany({
      where: { orderItemId: { in: input.lines.map((l) => l.orderItemId) }, status: "HELD" },
      data: { status: "FROZEN" },
    });
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: "NOTE",
        message: `Return requested for ${input.lines.reduce((a, l) => a + l.qty, 0)} item(s).`,
        actorId: input.buyerId,
      },
    });
    return created;
  });

  return request;
}

/** Legal return transitions. Terminal states have no exits. */
const NEXT: Record<string, string[]> = {
  REQUESTED: ["ACCEPTED", "REJECTED", "CANCELLED"],
  ACCEPTED: ["RECEIVED", "REJECTED", "CANCELLED"],
  RECEIVED: ["REFUNDED"],
  REFUNDED: [],
  REJECTED: [],
  CANCELLED: [],
};

export async function moveReturn(input: {
  returnId: string;
  to: "ACCEPTED" | "REJECTED" | "RECEIVED" | "REFUNDED" | "CANCELLED";
  actorId: string;
  actorRole: "BUYER" | "SELLER" | "ADMIN";
  sellerStoreIds?: string[];
  sellerNote?: string;
}) {
  const request = await db.returnRequest.findUnique({
    where: { id: input.returnId },
    include: { order: { select: { id: true, number: true, buyerId: true } } },
  });
  if (!request) throw new ReturnError("NOT_FOUND", "Return not found.");

  if (input.actorRole === "BUYER" && request.buyerId !== input.actorId) {
    throw new ReturnError("FORBIDDEN", "This isn't your return.");
  }
  if (input.actorRole === "SELLER" && !input.sellerStoreIds?.includes(request.storeId)) {
    throw new ReturnError("FORBIDDEN", "This return isn't for your store.");
  }
  // Only an admin can decide the money on a REFUNDED transition.
  if (input.to === "REFUNDED" && input.actorRole !== "ADMIN") {
    throw new ReturnError("FORBIDDEN", "Only support can complete a refund.");
  }
  if (!NEXT[request.status]?.includes(input.to)) {
    throw new ReturnError("INVALID", `Cannot move a return from ${request.status} to ${input.to}.`);
  }

  const lines = request.items as unknown as ReturnLine[];
  const terminal = input.to === "REFUNDED" || input.to === "REJECTED" || input.to === "CANCELLED";

  // Refund pro-rata: commission was already deducted when the hold was created,
  // so refund what the seller was owed, not the buyer's gross charge.
  const refundAmount = input.to === "REFUNDED" ? await refundValue(lines) : null;

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.returnRequest.update({
      where: { id: request.id },
      data: {
        status: input.to,
        ...(input.sellerNote ? { sellerNote: input.sellerNote.slice(0, 1000) } : {}),
        ...(refundAmount !== null ? { refundAmount } : {}),
        ...(terminal ? { resolvedAt: new Date() } : {}),
      },
    });

    const itemIds = lines.map((l) => l.orderItemId);
    if (input.to === "REFUNDED") {
      await tx.escrowHold.updateMany({ where: { orderItemId: { in: itemIds } }, data: { status: "REFUNDED" } });
    } else if (input.to === "REJECTED" || input.to === "CANCELLED") {
      // Unfreeze and let the normal release schedule take over again.
      await tx.escrowHold.updateMany({
        where: { orderItemId: { in: itemIds }, status: "FROZEN" },
        data: { status: "HELD" },
      });
    }

    await tx.orderEvent.create({
      data: {
        orderId: request.orderId,
        type: "NOTE",
        message: `Return ${input.to.toLowerCase()}${refundAmount !== null ? ` — refund $${refundAmount.toFixed(2)}` : ""}.`,
        actorId: input.actorId,
      },
    });
    return row;
  });

  return updated;
}

/** What the seller was actually owed on these lines — that's what we hand back. */
async function refundValue(lines: ReturnLine[]): Promise<number> {
  const holds = await db.escrowHold.findMany({
    where: { orderItemId: { in: lines.map((l) => l.orderItemId) } },
    select: { orderItemId: true, net: true, gross: true },
  });
  const byId = new Map(holds.map((h) => [h.orderItemId, h]));
  let sum = 0;
  for (const l of lines) {
    const h = byId.get(l.orderItemId);
    // No hold (e.g. already released): refund gross so the buyer is made whole.
    const unit = h && Number(h.gross) > 0 ? Number(h.net) / Number(h.gross) : 1;
    sum += l.price * l.qty * unit;
  }
  return Math.round(sum * 100) / 100;
}

/** Human label for a reason code. */
export function returnReasonLabel(reason: string): string {
  return (
    {
      NOT_AS_DESCRIBED: "Not as described",
      DEFECTIVE: "Defective",
      WRONG_ITEM: "Wrong item",
      NO_LONGER_NEEDED: "No longer needed",
      BETTER_PRICE_ELSEWHERE: "Found a better price",
      DAMAGED_IN_TRANSIT: "Damaged in transit",
      OTHER: "Other",
    } as Record<string, string>
  )[reason] ?? reason;
}

export { returnWindowDays };
