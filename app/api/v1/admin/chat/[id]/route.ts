import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { withAdmin } from "@/lib/api/guard";

/** Single conversation metadata: volume timeline only, never bodies. */
export const GET = withAdmin(
  async (_req, _actor, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const convo = await db.conversation.findUnique({
      where: { id },
      include: { _count: { select: { messages: true, envelopes: true } } },
    });
    if (!convo) return fail("NOT_FOUND", "Conversation not found", 404);
    const [users, order, product, store, stamps] = await Promise.all([
      db.user.findMany({
        where: { id: { in: [convo.buyerId, convo.sellerId] } },
        select: { id: true, name: true, email: true, role: true },
      }),
      convo.orderId
        ? db.order.findUnique({ where: { id: convo.orderId }, select: { number: true, status: true, total: true } })
        : null,
      convo.productId
        ? db.product.findUnique({ where: { id: convo.productId }, select: { title: true, slug: true } })
        : null,
      db.store.findUnique({ where: { id: convo.storeId }, select: { name: true, slug: true } }),
      db.chatMessage.findMany({
        where: { conversationId: id },
        select: { senderId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);
    return ok({
      id: convo.id,
      type: convo.type,
      subject: convo.subject,
      messageCount: convo._count.messages,
      envelopeCount: convo._count.envelopes,
      lastMessageAt: convo.lastMessageAt,
      createdAt: convo.createdAt,
      blocked: !!convo.blockedById,
      reportedAt: convo.reportedAt,
      reportReason: convo.reportReason,
      reportEvidence: convo.reportEvidence,
      users,
      order,
      product,
      store,
      activity: stamps,
    });
  }
, "chat");
