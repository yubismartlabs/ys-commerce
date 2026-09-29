import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { withAdmin } from "@/lib/api/guard";
import { open } from "@/lib/chat/server-crypto";

/** Single conversation: full transcript (trust & safety readable). */
export const GET = withAdmin(
  async (_req, _actor, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const convo = await db.conversation.findUnique({ where: { id } });
    if (!convo) return fail("NOT_FOUND", "Conversation not found", 404);
    const [users, order, product, store, rows] = await Promise.all([
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
        orderBy: { createdAt: "asc" },
        take: 200,
      }),
    ]);
    const transcript = rows.map((m) => {
      let text = "⚠ Unreadable (seal key missing).";
      try {
        text = open({ ciphertext: m.ciphertext, nonce: m.nonce, keyId: m.keyId });
      } catch {
        // keep placeholder
      }
      return {
        id: m.id,
        senderId: m.senderId,
        text,
        imageUrl: m.imageUrl,
        replyToId: m.replyToId,
        flagged: m.flagged,
        flaggedKinds: m.flaggedKinds,
        createdAt: m.createdAt,
      };
    });
    return ok({
      id: convo.id,
      type: convo.type,
      subject: convo.subject,
      messageCount: rows.length,
      lastMessageAt: convo.lastMessageAt,
      createdAt: convo.createdAt,
      blocked: !!convo.blockedById,
      reportedAt: convo.reportedAt,
      reportReason: convo.reportReason,
      users,
      order,
      product,
      store,
      transcript,
    });
  }
, "chat");
