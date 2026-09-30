import { db } from "@/lib/db";

export type QuoteItem = {
  productId: string;
  storeId: string;
  category: string;
  price: number;
  qty: number;
};

export type CouponRow = {
  id: string;
  code: string;
  type: "PERCENT" | "FIXED" | "FREESHIP";
  pctOff: number | null;
  amountOff: number | null;
  active: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  minSubtotal: number | null;
  maxUses: number | null;
  usedCount: number;
  perUserLimit: number | null;
  categories: string[];
  storeIds: string[];
};

export type Validation =
  | { ok: true; coupon: CouponRow; discount: number; shippingDiscount: number; eligibleSubtotal: number }
  | { ok: false; error: string };

const round = (n: number) => Math.round(n * 100) / 100;

function eligibleItems(coupon: CouponRow, items: QuoteItem[]): QuoteItem[] {
  return items.filter((i) => {
    if (coupon.categories.length > 0 && !coupon.categories.includes(i.category)) return false;
    if (coupon.storeIds.length > 0 && !coupon.storeIds.includes(i.storeId)) return false;
    return true;
  });
}

/**
 * Validate a coupon against a basket. Pure checks except for the
 * usage-count reads (caps are enforced for real inside the checkout
 * transaction, which re-runs this first).
 */
export async function validateCoupon(opts: {
  code: string;
  items: QuoteItem[];
  /** Total basket shipping. Used when no per-store breakdown is supplied. */
  shipping?: number;
  /**
   * Shipping per store. A store-scoped FREESHIP coupon may only waive the
   * shipping for its OWN parcels — otherwise a buyer's coupon would waive a
   * stranger's delivery fee, and the seller we'd have to reimburse.
   */
  shippingByStore?: Record<string, number>;
  userId?: string;
}): Promise<Validation> {
  const code = opts.code.trim().toUpperCase();
  if (!code) return { ok: false, error: "Enter a coupon code." };

  const row = await db.coupon.findUnique({ where: { code } });
  if (!row) return { ok: false, error: "This code doesn't exist." };
  const coupon: CouponRow = {
    ...row,
    pctOff: row.pctOff,
    amountOff: row.amountOff === null ? null : Number(row.amountOff),
    minSubtotal: row.minSubtotal === null ? null : Number(row.minSubtotal),
  };
  if (!coupon.active) return { ok: false, error: "This code is no longer active." };

  const now = new Date();
  if (coupon.startsAt && now < coupon.startsAt) return { ok: false, error: "This code isn't live yet." };
  if (coupon.endsAt && now > coupon.endsAt) return { ok: false, error: "This code has expired." };
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    return { ok: false, error: "This code has reached its usage limit." };
  }
  if (opts.userId && coupon.perUserLimit !== null) {
    const mine = await db.couponRedemption.count({
      where: { couponId: coupon.id, userId: opts.userId },
    });
    if (mine >= coupon.perUserLimit) return { ok: false, error: "You've already used this code." };
  }

  const eligible = eligibleItems(coupon, opts.items);
  if (eligible.length === 0 && opts.items.length > 0) {
    return { ok: false, error: "This code doesn't apply to items in your cart." };
  }
  const eligibleSubtotal = round(eligible.reduce((a, i) => a + i.price * i.qty, 0));
  if (coupon.minSubtotal !== null && eligibleSubtotal < coupon.minSubtotal) {
    return {
      ok: false,
      error: `Needs a $${coupon.minSubtotal.toFixed(2)} eligible subtotal (yours is $${eligibleSubtotal.toFixed(2)}).`,
    };
  }

  const shipping = opts.shipping ?? 0;
  if (coupon.type === "FREESHIP") {
    // Only waive the shipping this coupon is responsible for.
    let waivable = shipping;
    if (opts.shippingByStore) {
      const entries = Object.entries(opts.shippingByStore);
      // No storeIds on the coupon = platform-wide, so all of it is waivable.
      waivable = coupon.storeIds.length > 0
        ? entries.filter(([storeId]) => coupon.storeIds.includes(storeId)).reduce((a, [, cost]) => a + cost, 0)
        : entries.reduce((a, [, cost]) => a + cost, 0);
    }
    return { ok: true, coupon, discount: 0, shippingDiscount: round(waivable), eligibleSubtotal };
  }
  const discount =
    coupon.type === "PERCENT"
      ? round((eligibleSubtotal * (coupon.pctOff ?? 0)) / 100)
      : round(Math.min(coupon.amountOff ?? 0, eligibleSubtotal));
  if (discount <= 0) return { ok: false, error: "This code gives no discount on your cart." };
  return { ok: true, coupon, discount, shippingDiscount: 0, eligibleSubtotal };
}

/** Short human summary for admin + storefront display. */
export function describeCoupon(c: {
  type: string;
  pctOff: number | null;
  amountOff: unknown;
  minSubtotal: unknown;
}): string {
  const min = c.minSubtotal === null || c.minSubtotal === undefined ? null : Number(c.minSubtotal);
  const suffix = min ? ` over $${min.toFixed(2)}` : "";
  if (c.type === "FREESHIP") return "Free shipping";
  if (c.type === "FIXED") return `$${Number(c.amountOff ?? 0).toFixed(2)} off${suffix}`;
  return `${c.pctOff ?? 0}% off${suffix}`;
}
