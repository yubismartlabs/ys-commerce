import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { audit, withAdmin } from "@/lib/api/guard";

export const GET = withAdmin(
  async (_req, _actor, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const coupon = await db.coupon.findUnique({ where: { id } });
    if (!coupon) return fail("NOT_FOUND", "Coupon not found", 404);
    return ok(coupon);
  }
);

export const DELETE = withAdmin(
  async (_req, actor, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const coupon = await db.coupon.findUnique({ where: { id } });
    if (!coupon) return fail("NOT_FOUND", "Coupon not found", 404);

    await db.coupon.delete({ where: { id } });
    await audit(actor.id, "coupon.delete", "Coupon", id, { code: coupon.code });
    return ok({ deleted: true });
  }
);
