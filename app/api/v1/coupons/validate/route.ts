import { z } from "zod";
import { fail, ok } from "@/lib/api/http";
import { describeCoupon, validateCoupon } from "@/lib/coupons/engine";
import { cartLineSchema, resolveCart, shippingForLines } from "@/lib/coupons/cart";
import { auth } from "@/auth";

const validateSchema = z.object({
  code: z.string().min(1).max(32),
  items: z.array(cartLineSchema).min(1).max(50),
});

/** Quote a coupon against a basket without redeeming it. No auth required. */
export async function POST(req: Request) {
  const parsed = validateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION", "code and items[] required", 422);

  let lines;
  try {
    lines = await resolveCart(parsed.data.items);
  } catch (e) {
    return fail("VALIDATION", e instanceof Error ? e.message : "Invalid cart", 422);
  }
  const subtotal = lines.reduce((a, l) => a + l.price * l.qty, 0);
  const { byStore, total: shipping } = await shippingForLines(lines);

  const session = await auth();
  const userId = session?.user?.id;
  const result = await validateCoupon({
    code: parsed.data.code,
    items: lines,
    shipping,
    userId: userId ?? undefined,
  });
  if (!result.ok) return fail("COUPON", result.error, 422);

  const shippingFinal = Math.max(0, shipping - result.shippingDiscount);
  return ok({
    code: result.coupon.code,
    type: result.coupon.type,
    summary: describeCoupon(result.coupon),
    subtotal,
    discount: result.discount,
    shipping,
    // Per-store breakdown so the cart can show "3 parcels" with real numbers
    // instead of one opaque total.
    shippingByStore: Object.fromEntries(byStore),
    shippingDiscount: result.shippingDiscount,
    shippingFinal,
    total: Math.max(0, subtotal - result.discount + shippingFinal),
  });
}
