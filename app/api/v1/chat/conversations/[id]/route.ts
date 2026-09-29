import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { ApiError } from "@/lib/api/guard";
import { audit } from "@/lib/api/guard";
import { requireUser } from "@/lib/api/identity";
import { counterparty, getConversationFor } from "@/lib/chat/access";
import { publish } from "@/lib/chat/hub";

async function actor() {
  try {
    return await requireUser();
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw e;
  }
}

/** Conversation metadata + my envelope + read states. No message content here (see /messages). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let me;
  try {
    me = await actor();
  } catch (e) {
    if (e instanceof ApiError) return fail(e.code, e.message, e.status);
    throw e;
  }
  const { id } = await params;
  const convo = await getConversationFor(me.id, id);
  if (!convo) return fail("NOT_FOUND", "Conversation not found", 404);

  const [other, order, product, store, reads] = await Promise.all([
    counterparty(id, me.id),
    convo.orderId ? db.order.findUnique({ where: { id: convo.orderId }, select: { number: true, status: true, total: true } }) : null,
    convo.productId
      ? db.product.findUnique({ where: { id: convo.productId }, select: { title: true, slug: true, image: true, price: true } })
      : null,
    db.store.findUnique({ where: { id: convo.storeId }, select: { name: true, slug: true } }),
    db.conversationRead.findMany({ where: { conversationId: id } }),
  ]);
  return ok({
    id: convo.id,
    type: convo.type,
    subject: convo.subject,
    lastMessageAt: convo.lastMessageAt,
    createdAt: convo.createdAt,
    blockedById: convo.blockedById,
    reportedAt: convo.reportedAt,
    other,
    order,
    product,
    store,
    envelope: convo.envelopes[0] ?? null,
    readStates: reads.map((r) => ({ userId: r.userId, lastReadAt: r.lastReadAt })),
    iAmBuyer: convo.buyerId === me.id,
  });
}

const patchSchema = z.union([
  z.object({ action: z.literal("block") }),
  z.object({ action: z.literal("unblock") }),
  z.object({ action: z.literal("report"), reason: z.string().min(3).max(500) }),
]);

/** Block/unblock the peer, or report metadata (admins see metadata only — never content). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let me;
  try {
    me = await actor();
  } catch (e) {
    if (e instanceof ApiError) return fail(e.code, e.message, e.status);
    throw e;
  }
  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION", "action must be block, unblock or report", 422);

  const convo = await getConversationFor(me.id, id);
  if (!convo) return fail("NOT_FOUND", "Conversation not found", 404);

  if (parsed.data.action === "block") {
    await db.conversation.update({ where: { id }, data: { blockedById: me.id } });
    await audit(me.id, "chat.block", "Conversation", id, {});
    publish(id, { type: "notice", notice: "blocked" });
    return ok({ blocked: true });
  }
  if (parsed.data.action === "unblock") {
    if (convo.blockedById !== me.id) return fail("FORBIDDEN", "Only the blocker can unblock", 403);
    await db.conversation.update({ where: { id }, data: { blockedById: null } });
    await audit(me.id, "chat.unblock", "Conversation", id, {});
    publish(id, { type: "notice", notice: "unblocked" });
    return ok({ blocked: false });
  }
  await db.conversation.update({
    where: { id },
    data: { reportedAt: new Date(), reportReason: parsed.data.reason },
  });
  await audit(me.id, "chat.report", "Conversation", id, { reason: parsed.data.reason });
  return ok({ reported: true });
}
