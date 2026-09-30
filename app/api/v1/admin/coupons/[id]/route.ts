import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { audit, withAdmin } from "@/lib/api/guard";
import { couponFields } from "@/lib/coupons/schema";
import { pickSent } from "@/lib/api/patch";

export const GET = withAdmin(
  async (_req, _actor, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const coupon = await db.coupon.findUnique({
      where: { id },
      include: {
        redemptions: { orderBy: { createdAt: "desc" }, take: 20 },
        _count: { select: { redemptions: true } },
      },
    });
    if (!coupon) return fail("NOT_FOUND", "Coupon not found", 404);
    return ok(coupon);
  }
, "coupons");

export const PATCH = withAdmin(
  async (req, actor, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    // Partial update: code is immutable (rotating codes = new coupon).
    // `couponFields` (not `couponInput`) so create-only cross-field rules
    // aren't applied to a partial edit.
    const schema = couponFields.omit({ code: true }).partial();
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return fail("VALIDATION", parsed.error.issues[0]?.message ?? "Invalid coupon", 422);
    }

    const coupon = await db.coupon.findUnique({ where: { id } });
    if (!coupon) return fail("NOT_FOUND", "Coupon not found", 404);

    // Drop schema defaults for unsent keys, otherwise editing `active` on a
    // scoped FREESHIP coupon wipes its storeIds/categories and flips it to PERCENT.
    const { startsAt, endsAt, ...rest } = pickSent(parsed.data, body) as typeof parsed.data;
    const type = rest.type ?? coupon.type;
    if (type === "PERCENT" && rest.pctOff === undefined && coupon.pctOff === null) {
      return fail("VALIDATION", "pctOff is required for percent coupons", 422);
    }
    if (type === "FIXED" && rest.amountOff === undefined && coupon.amountOff === null) {
      return fail("VALIDATION", "amountOff is required for fixed coupons", 422);
    }

    const updated = await db.coupon.update({
      where: { id },
      data: {
        ...rest,
        ...(type === "PERCENT" ? { amountOff: null } : {}),
        ...(type === "FIXED" ? { pctOff: null } : {}),
        ...(type === "FREESHIP" ? { pctOff: null, amountOff: null } : {}),
        ...(startsAt !== undefined ? { startsAt: startsAt ? new Date(startsAt) : null } : {}),
        ...(endsAt !== undefined ? { endsAt: endsAt ? new Date(endsAt) : null } : {}),
      },
    });
    await audit(actor.id, "coupon.update", "Coupon", id, { code: coupon.code });
    return ok(updated);
  }
, "coupons");

export const DELETE = withAdmin(
  async (_req, actor, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const coupon = await db.coupon.findUnique({ where: { id } });
    if (!coupon) return fail("NOT_FOUND", "Coupon not found", 404);

    await db.coupon.delete({ where: { id } });
    await audit(actor.id, "coupon.delete", "Coupon", id, { code: coupon.code });
    return ok({ deleted: true });
  }
, "coupons");
