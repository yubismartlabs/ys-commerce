import { z } from "zod";
import { db } from "@/lib/db";
import { fail, getPagination, ok } from "@/lib/api/http";
import { withAdmin } from "@/lib/api/guard";

export const GET = withAdmin(async (req) => {
  const url = new URL(req.url);
  const { page, pageSize, skip } = getPagination(url);
  const [total, coupons] = await Promise.all([
    db.coupon.count(),
    db.coupon.findMany({ skip, take: pageSize, orderBy: { createdAt: "desc" } }),
  ]);
  return ok(coupons, { page, pageSize, total });
});

const createSchema = z.object({
  code: z.string().min(3).max(32).toUpperCase(),
  pctOff: z.number().int().min(1).max(90),
});

export const POST = withAdmin(async (req, actor) => {
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION", "code (3-32 chars) and pctOff (1-90) required", 422);

  const existing = await db.coupon.findUnique({ where: { code: parsed.data.code } });
  if (existing) return fail("CONFLICT", "Coupon code already exists", 409);

  const coupon = await db.coupon.create({ data: parsed.data });
  await db.auditLog.create({
    data: { actorId: actor.id, action: "coupon.create", entity: "Coupon", entityId: coupon.id },
  });
  return ok(coupon, undefined, 201);
});
