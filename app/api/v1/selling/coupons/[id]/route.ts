import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { isSuspended } from "@/lib/api/identity";

const updateSchema = z.object({
  active: z.boolean().optional(),
  maxUses: z.number().int().min(1).max(100000).nullable().optional(),
  perUserLimit: z.number().int().min(1).max(100).nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  minSubtotal: z.number().min(0).max(1000000).nullable().optional(),
});

/** A seller may only edit a coupon that targets one of their own stores. */
async function ownedCoupon(id: string, userId: string) {
  const storeIds = (await db.store.findMany({ where: { ownerId: userId }, select: { id: true } })).map((s) => s.id);
  if (storeIds.length === 0) return null;
  const coupon = await db.coupon.findFirst({ where: { id, storeIds: { hasSome: storeIds } } });
  return coupon;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);

  const { id } = await params;
  const coupon = await ownedCoupon(id, userId);
  if (!coupon) return fail("NOT_FOUND", "Coupon not found", 404);
  return ok(coupon);
}

/**
 * Edit the levers a seller should control: pause, extend, cap usage.
 * Code, discount value and store scope are immutable once buyers may have
 * seen the code — changing a 50%-off code to 5% after the fact is bait.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);
  if (await isSuspended(userId)) return fail("SUSPENDED", "This account is suspended", 403);

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION", "Invalid update", 422);

  const { id } = await params;
  const coupon = await ownedCoupon(id, userId);
  if (!coupon) return fail("NOT_FOUND", "Coupon not found", 404);

  const d = parsed.data;
  const updated = await db.coupon.update({
    where: { id },
    data: {
      ...(d.active !== undefined ? { active: d.active } : {}),
      ...(d.maxUses !== undefined ? { maxUses: d.maxUses } : {}),
      ...(d.perUserLimit !== undefined ? { perUserLimit: d.perUserLimit } : {}),
      ...(d.minSubtotal !== undefined ? { minSubtotal: d.minSubtotal } : {}),
      ...(d.endsAt !== undefined ? { endsAt: d.endsAt ? new Date(d.endsAt) : null } : {}),
    },
  });
  return ok(updated);
}

/**
 * Delete only if nobody has redeemed it. A coupon with history stays as a
 * record — deleting it would orphan its redemptions and rewrite the seller's
 * past revenue reports.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);

  const { id } = await params;
  const coupon = await ownedCoupon(id, userId);
  if (!coupon) return fail("NOT_FOUND", "Coupon not found", 404);

  const used = await db.couponRedemption.count({ where: { couponId: id } });
  if (used > 0) {
    return fail("CONFLICT", `This code has been used ${used} time(s) — deactivate it instead.`, 409);
  }
  await db.coupon.delete({ where: { id } });
  return ok({ deleted: true });
}
