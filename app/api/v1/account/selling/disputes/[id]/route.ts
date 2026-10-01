import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { audit } from "@/lib/api/guard";
import { isSuspended } from "@/lib/api/identity";
import { evaluateMessage } from "@/lib/chat/safety";
import { notifyAdmins, notifyUser } from "@/lib/notifications/notify";

/** Seller reads a dispute involving their items. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);
  const { id } = await params;

  const stores = await db.store.findMany({ where: { ownerId: userId }, select: { id: true } });
  const storeIds = stores.map((s) => s.id);
  const dispute = await db.dispute.findUnique({
    where: { id },
    include: {
      order: { select: { number: true, total: true, status: true, items: { select: { storeId: true } } } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!dispute || !dispute.order.items.some((i) => storeIds.includes(i.storeId))) {
    return fail("NOT_FOUND", "Dispute not found", 404);
  }
  return ok(dispute);
}

const replySchema = z.object({ message: z.string().min(1).max(2000) });

/** Seller responds on an open/under-review dispute with their items. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);
  if (await isSuspended(userId)) return fail("SUSPENDED", "This account is suspended", 403);
  const { id } = await params;

  const parsed = replySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION", "message required", 422);

  const screen = evaluateMessage(parsed.data.message);
  if (screen.level === "block") return fail("PROTECTION", screen.message ?? "Content blocked", 422);

  const stores = await db.store.findMany({ where: { ownerId: userId }, select: { id: true } });
  const storeIds = stores.map((s) => s.id);
  const dispute = await db.dispute.findUnique({
    where: { id },
    include: { order: { select: { number: true, items: { select: { storeId: true } } } } },
  });
  if (!dispute || !dispute.order.items.some((i) => storeIds.includes(i.storeId))) {
    return fail("NOT_FOUND", "Dispute not found", 404);
  }
  if (!["OPEN", "UNDER_REVIEW"].includes(dispute.status)) {
    return fail("DISPUTE", "This dispute is closed to new messages", 422);
  }

  const message = await db.disputeMessage.create({
    data: { disputeId: id, author: "seller", authorId: userId, body: parsed.data.message },
  });
  await audit(userId, "dispute.reply", "Dispute", id, { by: "seller" });
  await notifyUser({
    userId: dispute.buyerId,
    type: "dispute.message",
    title: `Seller responded on order ${dispute.order.number}`,
    meta: { entityId: id },
  });
  await notifyAdmins({
    type: "dispute.message",
    title: `Seller replied on order ${dispute.order.number}`,
    link: `/ys-admin/disputes/show/${id}`,
    meta: { entityId: id },
  });
  return ok(message, undefined, 201);
}
