import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serialize } from "@/lib/api/http";
import { describeCoupon } from "@/lib/coupons/engine";

/** Public list of currently-redeemable coupons (no usage internals). */
export async function GET() {
  const now = new Date();
  const coupons = await db.coupon.findMany({
    where: {
      active: true,
      AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
    select: { code: true, type: true, pctOff: true, amountOff: true, minSubtotal: true, categories: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(
    serialize({
      data: coupons.map((c) => ({
        code: c.code,
        type: c.type,
        summary: describeCoupon(c),
        minSubtotal: c.minSubtotal === null ? null : Number(c.minSubtotal),
        categories: c.categories,
      })),
    })
  );
}
