import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { cartLineSchema, resolveCart, shippingForLines } from "@/lib/coupons/cart";

const querySchema = z.object({
  lines: z.string().min(1),
});

export type StoreShipping = { storeId: string; storeName: string; cost: number };

/**
 * Live per-store shipping for the cart and checkout summary.
 *
 * With split fulfilment the buyer needs to know how many parcels they are
 * paying for and what each costs, before they commit. Works with or without a
 * coupon (the coupon endpoint is only reachable once a code is applied).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({ lines: url.searchParams.get("lines") ?? "" });
  if (!parsed.success) return fail("VALIDATION", "lines is required", 422);

  let decoded: unknown;
  try {
    decoded = JSON.parse(decodeURIComponent(parsed.data.lines));
  } catch {
    return fail("VALIDATION", "lines must be a URL-encoded JSON array", 422);
  }
  const lines = z.array(cartLineSchema).min(1).max(50).safeParse(decoded);
  if (!lines.success) return fail("VALIDATION", "Invalid cart lines", 422);

  let resolved;
  try {
    resolved = await resolveCart(lines.data);
  } catch (e) {
    return fail("VALIDATION", e instanceof Error ? e.message : "Invalid cart", 422);
  }

  const { byStore, total } = await shippingForLines(resolved);

  // Store display names, in one query rather than N.
  const stores = await db.store.findMany({
    where: { id: { in: [...byStore.keys()] } },
    select: { id: true, name: true, slug: true, logo: true },
  });
  const nameById = new Map(stores.map((s) => [s.id, s]));

  const breakdown: StoreShipping[] = [...byStore.entries()].map(([storeId, cost]) => ({
    storeId,
    storeName: nameById.get(storeId)?.name ?? "Store",
    cost,
  }));

  return ok({
    subtotal: Math.round(resolved.reduce((a, l) => a + l.price * l.qty, 0) * 100) / 100,
    shipping: total,
    parcels: breakdown.length,
    byStore: breakdown,
  });
}
