import { z } from "zod";

/**
 * Base field shapes, WITHOUT the create-time cross-field rules. PATCH builds
 * on this so an edit can't be rejected by create-only invariants (e.g. a
 * FREESHIP coupon has no `pctOff`); the PATCH route validates the merged
 * row instead.
 */
export const couponFields = z.object({
  code: z.string().min(3).max(32).toUpperCase(),
  type: z.enum(["PERCENT", "FIXED", "FREESHIP"]).default("PERCENT"),
  pctOff: z.number().int().min(1).max(90).optional(),
  amountOff: z.number().min(0.01).max(100000).optional(),
  active: z.boolean().default(true),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  minSubtotal: z.number().min(0).max(1000000).nullable().optional(),
  maxUses: z.number().int().min(1).max(1000000).nullable().optional(),
  perUserLimit: z.number().int().min(1).max(1000).nullable().optional(),
  categories: z.array(z.string().min(1).max(60)).max(50).default([]),
  storeIds: z.array(z.string().min(1)).max(100).default([]),
});

/** Full coupon payload (create). */
export const couponInput = couponFields.superRefine((v, ctx) => {
  if (v.type === "PERCENT" && v.pctOff === undefined) {
    ctx.addIssue({ code: "custom", message: "pctOff is required for percent coupons" });
  }
  if (v.type === "FIXED" && v.amountOff === undefined) {
    ctx.addIssue({ code: "custom", message: "amountOff is required for fixed coupons" });
  }
  if (v.startsAt && v.endsAt && new Date(v.startsAt) >= new Date(v.endsAt)) {
    ctx.addIssue({ code: "custom", message: "endsAt must be after startsAt" });
  }
});

export type CouponInput = z.infer<typeof couponInput>;
