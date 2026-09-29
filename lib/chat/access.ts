import { db } from "@/lib/db";

/** Conversation iff the user is buyer or seller. Includes my read row. */
export async function getConversationFor(userId: string, id: string) {
  const convo = await db.conversation.findUnique({
    where: { id },
    include: {
      reads: { where: { userId } },
    },
  });
  if (!convo || (convo.buyerId !== userId && convo.sellerId !== userId)) return null;
  return convo;
}

export async function counterparty(conversationId: string, meId: string) {
  const convo = await db.conversation.findUnique({
    where: { id: conversationId },
    select: { buyerId: true, sellerId: true },
  });
  if (!convo) return null;
  const otherId = convo.buyerId === meId ? convo.sellerId : convo.buyerId;
  return db.user.findUnique({ where: { id: otherId }, select: { id: true, name: true, email: true } });
}
