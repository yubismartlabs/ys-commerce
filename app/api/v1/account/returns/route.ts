import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fail, getPagination, ok } from "@/lib/api/http";
import { isSuspended } from "@/lib/api/identity";
import { clientKey, limit } from "@/lib/api/rate-limit";
import { createReturn, ReturnError, RETURN_REASONS } from "@/lib/returns/returns";

const createSchema = z.object({
  orderNumber: z.string().min(1).max(40),
  reason: z.enum(RETURN_REASONS),
  note: z.string().max(1000).optional(),
  lines: z
    .array(z.object({ orderItemId: z.string().min(1), qty: z.number().int().min(1).max(99) }))
    .min(1)
    .max(50),
});

/** Buyer's own return requests. */
export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);

  const { page, pageSize, skip } = getPagination(new URL(req.url));
  const where = { buyerId: userId };
  const [total, returns] = await Promise.all([
    db.returnRequest.count({ where }),
    db.returnRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        store: { select: { id: true, name: true, slug: true } },
        order: { select: { number: true } },
      },
    }),
  ]);
  return ok(returns, { page, pageSize, total });
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);
  if (await isSuspended(userId)) return fail("SUSPENDED", "This account is suspended", 403);

  // Filing freezes escrow, so a burst of these from one account is both a
  // support-queue problem and a way to hold a seller's funds hostage.
  const rl = await limit(clientKey(req, "returns", userId), 5, 60 * 60 * 1000);
  if (!rl.ok) {
    return fail("RATE_LIMITED", "You've filed several return requests recently. Contact support.", 429, {
      retryAfterSeconds: rl.retryAfterSeconds,
    });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail("VALIDATION", parsed.error.issues[0]?.message ?? "Invalid return request", 422);
  }

  try {
    const created = await createReturn({ ...parsed.data, buyerId: userId });
    return ok(created, undefined, 201);
  } catch (e) {
    if (e instanceof ReturnError) {
      const status = e.code === "NOT_FOUND" ? 404 : e.code === "CONFLICT" ? 409 : e.code === "FORBIDDEN" ? 403 : 422;
      return fail(e.code, e.message, status);
    }
    console.error("[returns] create failed:", e);
    return fail("RETURNS", "Couldn't open the return request", 500);
  }
}
