import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSettingGroup } from "@/lib/server-settings";

const round = (n: number) => Math.round(n * 100) / 100;

type Tx = Prisma.TransactionClient;

/** Buyer-protection ledger over paid order lines. All amounts USD. */

// ---------------------------------------------------------------------------
// Holds
// ---------------------------------------------------------------------------

/** Lock one hold per order line at checkout (inside the order transaction). */
export async function createHoldsForOrder(
  tx: Tx,
  opts: {
    orderId: string;
    lines: Array<{ orderItemId: string; storeId: string; lineTotal: number }>;
    discountRatio: number; // 0..1 share of subtotal taken by coupon
  }
): Promise<void> {
  const storeIds = [...new Set(opts.lines.map((l) => l.storeId))];
  const stores = await tx.store.findMany({ where: { id: { in: storeIds } }, select: { id: true, commissionRate: true } });
  const rate = new Map(stores.map((s) => [s.id, Number(s.commissionRate)]));
  for (const line of opts.lines) {
    const gross = round(line.lineTotal * (1 - opts.discountRatio));
    const commission = round(gross * (rate.get(line.storeId) ?? 0.05));
    await tx.escrowHold.create({
      data: {
        orderId: opts.orderId,
        orderItemId: line.orderItemId,
        storeId: line.storeId,
        gross,
        commission,
        net: round(gross - commission),
      },
    });
  }
}

/** Freeze HELD funds when a dispute opens. */
export async function freezeForOrder(orderId: string): Promise<number> {
  const r = await db.escrowHold.updateMany({ where: { orderId, status: "HELD" }, data: { status: "FROZEN" } });
  return r.count;
}

// ---------------------------------------------------------------------------
// Ruling settlement (auto-move funds)
// ---------------------------------------------------------------------------

/** Buyer wins: outstanding holds go back to the refund pool. */
export async function settleBuyerWin(orderId: string): Promise<number> {
  const r = await db.escrowHold.updateMany({
    where: { orderId, status: { in: ["HELD", "FROZEN"] } },
    data: { status: "REFUNDED" },
  });
  return r.count;
}

/** Seller wins: unfreeze, then release whatever is already due. */
export async function settleSellerWin(orderId: string): Promise<{ released: number; accrued: number }> {
  await db.escrowHold.updateMany({ where: { orderId, status: "FROZEN" }, data: { status: "HELD" } });
  return releaseDue(orderId);
}

// ---------------------------------------------------------------------------
// Scheduled release + payouts
// ---------------------------------------------------------------------------

/**
 * Release HELD funds whose protection expired with no live dispute.
 * Accrues each store's share into its PENDING payout. Idempotent.
 */
export async function releaseDue(onlyOrderId?: string): Promise<{ released: number; accrued: number }> {
  const now = new Date();
  // Sellers get an operator-configured settling buffer AFTER the buyer
  // protection window closes. Previously `escrowReleaseDays` was a live
  // setting read by nothing, so funds released the moment protection expired.
  const { escrowReleaseDays } = await getSettingGroup("commerce");
  const releaseCutoff = new Date(now.getTime() - Math.max(0, escrowReleaseDays) * 86400000);
  // Prisma has no relation from EscrowHold→Order, so join via order query.
  const due = await db.order.findMany({
    where: {
      status: "DELIVERED",
      protectionUntil: { lte: releaseCutoff },
      ...(onlyOrderId ? { id: onlyOrderId } : {}),
      disputes: { none: { status: { in: ["OPEN", "UNDER_REVIEW"] } } },
    },
    select: { id: true },
  });
  const dueIds = new Set(due.map((o) => o.id));
  if (dueIds.size === 0) return { released: 0, accrued: 0 };

  const releasable = await db.escrowHold.findMany({
    where: { status: "HELD", orderId: { in: [...dueIds] } },
  });
  if (releasable.length === 0) return { released: 0, accrued: 0 };

  const byStore = new Map<string, number>();
  for (const h of releasable) {
    byStore.set(h.storeId, round((byStore.get(h.storeId) ?? 0) + Number(h.net)));
  }

  await db.$transaction(async (tx) => {
    await tx.escrowHold.updateMany({
      where: { id: { in: releasable.map((h) => h.id) }, status: "HELD" },
      data: { status: "RELEASED", releasedAt: new Date() },
    });
    for (const [storeId, net] of byStore) {
      const open = await tx.payout.findFirst({ where: { storeId, status: "PENDING" } });
      if (open) {
        await tx.payout.update({ where: { id: open.id }, data: { amount: round(Number(open.amount) + net) } });
      } else {
        await tx.payout.create({ data: { storeId, amount: net } });
      }
    }
  });
  return { released: releasable.length, accrued: byStore.size };
}

/** Auto-pay PENDING payouts at/above the minimum (mock processor). */
export async function runPayouts(): Promise<{ paid: number; total: number }> {
  const payments = await getSettingGroup("payments");
  // Honour the configured payout cadence. Previously every eligible payout was
  // paid on every scheduler tick, so the "daily / weekly / monthly" setting had
  // no effect at all.
  const now = Date.now();
  const cadenceMs =
    payments.payoutSchedule === "daily"
      ? 86400000
      : payments.payoutSchedule === "weekly"
        ? 7 * 86400000
        : 30 * 86400000;
  const earliest = new Date(now - cadenceMs);

  const eligible = await db.payout.findMany({
    where: {
      status: "PENDING",
      amount: { gte: payments.payoutMinimum },
      // Only pay what has been sitting long enough for this cadence.
      createdAt: { lte: earliest },
    },
  });
  if (eligible.length === 0) return { paid: 0, total: 0 };
  const total = eligible.reduce((a, p) => a + Number(p.amount), 0);
  await db.payout.updateMany({
    where: { id: { in: eligible.map((p) => p.id) }, status: "PENDING" },
    data: { status: "PAID", paidAt: new Date() },
  });
  return { paid: eligible.length, total: round(total) };
}

/** Seller balance sheet for the payouts page. */
export async function storeBalance(storeId: string): Promise<{
  held: number;
  frozen: number;
  pendingPayout: number;
  paidLifetime: number;
}> {
  const [holds, payouts] = await Promise.all([
    db.escrowHold.groupBy({ by: ["status"], where: { storeId }, _sum: { net: true } }),
    db.payout.groupBy({ by: ["status"], where: { storeId }, _sum: { amount: true } }),
  ]);
  const holdSum = (s: string) =>
    round(holds.filter((h) => h.status === s).reduce((a, h) => a + Number(h._sum.net ?? 0), 0));
  const payoutSum = (s: string) =>
    round(payouts.filter((p) => p.status === s).reduce((a, p) => a + Number(p._sum.amount ?? 0), 0));
  return {
    held: holdSum("HELD"),
    frozen: holdSum("FROZEN"),
    pendingPayout: payoutSum("PENDING"),
    paidLifetime: payoutSum("PAID"),
  };
}

// ---------------------------------------------------------------------------
// Filing eligibility
// ---------------------------------------------------------------------------

export async function filingEligibility(orderId: string, buyerId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order || order.buyerId !== buyerId) return { ok: false, error: "Order not found." };
  if (order.status === "CANCELLED" || order.status === "REFUNDED") {
    return { ok: false, error: "Closed orders can't be disputed — contact support." };
  }
  const open = await db.dispute.findFirst({
    where: { orderId, status: { in: ["OPEN", "UNDER_REVIEW"] } },
  });
  if (open) return { ok: false, error: "This order already has an open dispute." };
  // protectionUntil is stamped when the LAST parcel is delivered. Until then
  // the window is still open.
  if (order.status === "DELIVERED" && order.protectionUntil && new Date() > order.protectionUntil) {
    return { ok: false, error: "The buyer-protection window for this order has closed." };
  }
  return { ok: true };
}
