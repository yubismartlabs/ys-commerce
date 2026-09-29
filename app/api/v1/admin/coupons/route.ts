import { db } from "@/lib/db";
import { getPagination, ok, fail } from "@/lib/api/http";
import { audit, withAdmin } from "@/lib/api/guard";
import { couponInput } from "@/lib/coupons/schema";

export const GET = withAdmin(async (req) => {
  const url = new URL(req.url);
  const active = url.searchParams.get("active");
  const type = url.searchParams.get("type");
  const q = url.searchParams.get("q");
  const { page, pageSize, skip } = getPagination(url);

  const where = {
    ...(active === "1" ? { active: true } : active === "0" ? { active: false } : {}),
    ...(type ? { type: type as "PERCENT" | "FIXED" | "FREESHIP" } : {}),
    ...(q ? { code: { contains: q.toUpperCase(), mode: "insensitive" as const } } : {}),
  };
  const [total, coupons] = await Promise.all([
    db.coupon.count({ where }),
    db.coupon.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { redemptions: true } } },
    }),
  ]);
  return ok(coupons, { page, pageSize, total });
}, "coupons");

export const POST = withAdmin(async (req, actor) => {
  const parsed = couponInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail("VALIDATION", parsed.error.issues[0]?.message ?? "Invalid coupon", 422);
  }

  const existing = await db.coupon.findUnique({ where: { code: parsed.data.code } });
  if (existing) return fail("CONFLICT", "Coupon code already exists", 409);

  const { startsAt, endsAt, ...rest } = parsed.data;
  const coupon = await db.coupon.create({
    data: {
      ...rest,
      pctOff: parsed.data.type === "PERCENT" ? parsed.data.pctOff! : null,
      amountOff: parsed.data.type === "FIXED" ? parsed.data.amountOff! : null,
      startsAt: startsAt ? new Date(startsAt) : null,
      endsAt: endsAt ? new Date(endsAt) : null,
    },
  });
  await audit(actor.id, "coupon.create", "Coupon", coupon.id, { code: coupon.code });
  return ok(coupon, undefined, 201);
}, "coupons");
