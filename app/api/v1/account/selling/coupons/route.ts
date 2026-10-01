import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fail, getPagination, ok } from "@/lib/api/http";
import { isSuspended } from "@/lib/api/identity";

/**
 * Seller coupons.
 *
 * The coupon engine has always honoured `storeIds`; only the admin console
 * could create one. Store coupons are a primary conversion lever, so sellers
 * get them too — always scoped to stores the seller owns.
 */

/** Shared shape so create and update can't drift. */
const couponSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3, "Code must be 3+ characters")
    .max(24)
    .regex(/^[A-Z0-9_-]+$/i, "Use letters, numbers, dashes and underscores only")
    .transform((v) => v.toUpperCase()),
  type: z.enum(["PERCENT", "FIXED", "FREESHIP"]),
  pctOff: z.number().int().min(1).max(90).optional().nullable(),
  amountOff: z.number().min(0.01).max(100000).optional().nullable(),
  minSubtotal: z.number().min(0).max(1000000).optional().nullable(),
  maxUses: z.number().int().min(1).max(100000).optional().nullable(),
  perUserLimit: z.number().int().min(1).max(100).optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  categories: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
  active: z.boolean().optional(),
});

/** Type-specific fields must be coherent, or the coupon silently does nothing. */
function shapeError(data: z.infer<typeof couponSchema>): string | null {
  if (data.type === "PERCENT" && !data.pctOff) return "A percent coupon needs pctOff (1–90).";
  if (data.type === "FIXED" && !data.amountOff) return "A fixed coupon needs amountOff.";
  return null;
}

/** Sellers may only target stores they own. */
async function ownStoreIds(userId: string): Promise<string[]> {
  const stores = await db.store.findMany({ where: { ownerId: userId }, select: { id: true } });
  return stores.map((s) => s.id);
}

export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);

  const storeIds = await ownStoreIds(userId);
  if (storeIds.length === 0) {
    return fail("FORBIDDEN", "Open a store before creating coupons.", 403);
  }

  const { page, pageSize, skip } = getPagination(new URL(req.url));
  const storeId = req.headers.get("x-store-id") ?? undefined;
  const scoped = storeId ? storeIds.filter((id) => id === storeId) : storeIds;

  const where = { storeIds: { hasSome: scoped } };
  const [total, coupons] = await Promise.all([
    db.coupon.count({ where }),
    db.coupon.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: { _count: { select: { redemptions: true } } },
    }),
  ]);

  // Coupon.storeIds is a plain String[], not a relation, so names are resolved
  // here rather than with an `include`.
  const stores = await db.store.findMany({
    where: { id: { in: storeIds } },
    select: { id: true, name: true },
  });
  const nameById = new Map(stores.map((s) => [s.id, s.name]));

  const rows = coupons.map((c) => ({
    ...c,
    storeNames: c.storeIds.map((id) => nameById.get(id) ?? "").filter(Boolean),
  }));

  return ok(rows, { page, pageSize, total });
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);
  if (await isSuspended(userId)) return fail("SUSPENDED", "This account is suspended", 403);

  const storeIds = await ownStoreIds(userId);
  if (storeIds.length === 0) return fail("FORBIDDEN", "Open a store before creating coupons.", 403);

  const parsed = couponSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION", parsed.error.issues[0]?.message ?? "Invalid coupon", 422);
  const shape = shapeError(parsed.data);
  if (shape) return fail("VALIDATION", shape, 422);

  const clash = await db.coupon.findUnique({ where: { code: parsed.data.code } });
  if (clash) return fail("CONFLICT", `${parsed.data.code} already exists.`, 409);

  const d = parsed.data;
  const coupon = await db.coupon.create({
    data: {
      code: d.code,
      type: d.type,
      pctOff: d.type === "PERCENT" ? d.pctOff! : null,
      amountOff: d.type === "FIXED" ? d.amountOff! : null,
      minSubtotal: d.minSubtotal ?? null,
      maxUses: d.maxUses ?? null,
      perUserLimit: d.perUserLimit ?? null,
      endsAt: d.endsAt ? new Date(d.endsAt) : null,
      // Normalised so a filter on the free-text category column still matches.
      categories: (d.categories ?? []).map((c) => c.trim().toLowerCase()),
      storeIds,
      active: d.active ?? true,
    },
  });
  return ok(coupon, undefined, 201);
}
