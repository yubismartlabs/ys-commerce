/**
 * Client-safe mirror of the coupon summary in lib/coupons/engine.ts, which
 * imports Prisma and cannot be pulled into a client bundle.
 */
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
