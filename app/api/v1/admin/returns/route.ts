import { z } from "zod";
import { db } from "@/lib/db";
import { fail, getPagination, ok } from "@/lib/api/http";
import { audit, withAdmin } from "@/lib/api/guard";
import { moveReturn, ReturnError } from "@/lib/returns/returns";
import { notifyUser } from "@/lib/notifications/notify";
import { getSettingGroup } from "@/lib/server-settings";
import { accountPath } from "@/lib/account-path";

const patchSchema = z.object({
  to: z.enum(["ACCEPTED", "REJECTED", "RECEIVED", "REFUNDED"]),
  note: z.string().max(1000).optional(),
});

/** Returns queue. Area "orders" — they are order-level after-sales. */
export const GET = withAdmin(async (req) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  const { page, pageSize, skip } = getPagination(url);
  const where = { ...(status ? { status: status as never } : {}) };
  const [total, returns] = await Promise.all([
    db.returnRequest.count({ where }),
    db.returnRequest.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        order: { select: { number: true, status: true } },
        buyer: { select: { email: true, name: true } },
        store: { select: { id: true, name: true, slug: true } },
      },
    }),
  ]);
  return ok(returns, { page, pageSize, total });
}, "orders");

/**
 * Support drives the final transitions. REFUNDED is admin-only: it moves the
 * escrow hold to REFUNDED so the seller is never paid for returned goods, and
 * it is the only place real money would be returned to the buyer.
 */
export const PATCH = withAdmin(async (req, actor) => {
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION", "Invalid transition", 422);

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return fail("VALIDATION", "Missing ?id=", 422);

  try {
    const updated = await moveReturn({
      returnId: id,
      to: parsed.data.to,
      actorId: actor.id,
      actorRole: "ADMIN",
      ...(parsed.data.note ? { sellerNote: parsed.data.note } : {}),
    });
    await audit(actor.id, "return.transition", "ReturnRequest", id, {
      to: parsed.data.to,
      refundAmount: updated.refundAmount?.toString() ?? null,
    });

    const request = await db.returnRequest.findUnique({
      where: { id },
      include: { order: { select: { number: true } } },
    });
    if (request) {
      const site = await getSettingGroup("site");
      await notifyUser({
        userId: request.buyerId,
        type: `return.${parsed.data.to.toLowerCase()}`,
        title:
          parsed.data.to === "REFUNDED"
            ? `Refund issued for order ${request.order.number}`
            : `Return ${parsed.data.to.toLowerCase()} — order ${request.order.number}`,
        body: updated.refundAmount ? `Refunded $${Number(updated.refundAmount).toFixed(2)}.` : undefined,
        link: accountPath("/returns", site.accountSlug),
        meta: { entityId: id },
      });
    }
    return ok(updated);
  } catch (e) {
    if (e instanceof ReturnError) {
      const status = e.code === "NOT_FOUND" ? 404 : e.code === "FORBIDDEN" ? 403 : e.code === "CONFLICT" ? 409 : 422;
      return fail(e.code, e.message, status);
    }
    console.error("[admin/returns] update failed:", e);
    return fail("RETURNS", "Couldn't update the return", 500);
  }
}, "orders");
