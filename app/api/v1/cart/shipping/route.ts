import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { cartLineSchema, resolveCart, shippingForLines, storeParcelFee } from "@/lib/coupons/cart";
import { getSettingGroup } from "@/lib/server-settings";

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

  // Per-line mode (?perLine=1): what each item would cost to ship bought
  // alone, for surfaces like the watchlist where the buyer compares items
  // rather than checking out a basket. A dead listing fails the whole quote
  // instead of silently returning a partial set of numbers — the caller sends
  // only live slugs and treats any failure as "no estimate".
  if (url.searchParams.get("perLine") === "1") {
    const shipping = await getSettingGroup("shipping");
    return ok({
      perLine: resolved.map((l) => ({
        slug: l.slug,
        cost: storeParcelFee([{ price: l.price, qty: l.qty, freeShipping: l.freeShipping, storeId: l.storeId }], shipping),
      })),
    });
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
    // Lines the seller has since run out of, so the cart can say so instead of
    // letting the buyer discover it at the till.
    unavailable: resolved
      .filter((l) => !l.variant && l.trackStock && l.available !== null && l.available <= 0)
      .map((l) => ({ slug: l.slug, title: l.title, available: l.available })),
  });
}
