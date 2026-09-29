import { z } from "zod";
import { db } from "@/lib/db";
import { fail, getPagination, ok } from "@/lib/api/http";
import { ApiError } from "@/lib/api/guard";
import { requireUser } from "@/lib/api/identity";
import { getConversationFor } from "@/lib/chat/access";
import { publish, rateLimited } from "@/lib/chat/hub";
import { getEmailConfig } from "@/lib/email/send";
import { notifyUser } from "@/lib/notifications/notify";
import { buyerPrefs } from "@/lib/lifecycle/prefs";

async function actor() {
  try {
    return await requireUser();
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw e;
  }
}

/** Ciphertext feed, newest last. Clients decrypt locally. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const url = new URL(req.url);
  const since = url.searchParams.get("since");
  const { page, pageSize, skip } = getPagination(url);
  const where = {
    conversationId: id,
    ...(since ? { createdAt: { gt: new Date(since) } } : {}),
  };
  const [total, messages] = await Promise.all([
    db.chatMessage.count({ where }),
    db.chatMessage.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "asc" },
      select: {
        id: true, senderId: true, ciphertext: true, nonce: true, keyVersion: true,
        replyToId: true, imageUrl: true, imageNonce: true, createdAt: true,
      },
    }),
  ]);
  return ok(messages, { page, pageSize, total });
}

const postSchema = z.object({
  ciphertext: z.string().min(16).max(12000),
  nonce: z.string().min(8).max(64),
  keyVersion: z.number().int().min(1).default(1),
  replyToId: z.string().optional(),
  imageUrl: z.string().max(500).optional(),
  imageNonce: z.string().max(64).optional(),
});

/** Store one sealed message. The server never sees plaintext. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let me;
  try {
    me = await actor();
  } catch (e) {
    if (e instanceof ApiError) return fail(e.code, e.message, e.status);
    throw e;
  }
  if (rateLimited(`chat:${me.id}`)) return fail("RATE_LIMITED", "Slow down — too many messages", 429);
  const { id } = await params;

  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION", "ciphertext + nonce required", 422);

  const convo = await db.conversation.findUnique({ where: { id } });
  if (!convo || (convo.buyerId !== me.id && convo.sellerId !== me.id)) {
    return fail("NOT_FOUND", "Conversation not found", 404);
  }
  if (convo.blockedById && convo.blockedById !== me.id) {
    return fail("FORBIDDEN", "This conversation is blocked", 403);
  }
  if (parsed.data.replyToId) {
    const target = await db.chatMessage.findUnique({ where: { id: parsed.data.replyToId }, select: { conversationId: true } });
    if (!target || target.conversationId !== id) return fail("VALIDATION", "Reply target not in this conversation", 422);
  }

  const message = await db.$transaction(async (tx) => {
    const m = await tx.chatMessage.create({
      data: {
        conversationId: id,
        senderId: me.id,
        ciphertext: parsed.data.ciphertext,
        nonce: parsed.data.nonce,
        keyVersion: parsed.data.keyVersion,
        replyToId: parsed.data.replyToId,
        imageUrl: parsed.data.imageUrl,
        imageNonce: parsed.data.imageNonce,
      },
    });
    await tx.conversation.update({ where: { id }, data: { lastMessageAt: new Date() } });
    await tx.conversationRead.upsert({
      where: { conversationId_userId: { conversationId: id, userId: me.id } },
      update: { lastReadAt: new Date() },
      create: { conversationId: id, userId: me.id },
    });
    return m;
  });

  publish(id, { type: "message", id: message.id, senderId: me.id, createdAt: message.createdAt });

  // Content-free nudge (peer role decides the deep link). Never blocks.
  const peerId = convo.buyerId === me.id ? convo.sellerId : convo.buyerId;
  const peer = await db.user.findUnique({ where: { id: peerId }, select: { role: true, email: true } });
  if (peer) {
    const config = await getEmailConfig();
    const prefs = await buyerPrefs(peerId);
    const link = peer.role === "BUYER" ? `/account/messages/${id}` : `/selling/messages/${id}`;
    await notifyUser({
      userId: peerId,
      type: "chat.message",
      title: "New message",
      body: convo.type === "ORDER" ? "About your order" : (convo.subject ?? "About a product"),
      link,
      meta: { entityId: id },
      email: {
        template: {
          subject: `[${config.siteName}] New message`,
          html: `<p>You have a new message${convo.subject ? ` about <strong>${convo.subject}</strong>` : ""}. Open the chat to read it — message contents are end-to-end encrypted.</p>`,
          text: `You have a new message. Open the chat to read it.`,
        },
        name: "chat.message",
        enabled: config.enabled && prefs.chat,
      },
    });
  }
  return ok({ id: message.id, createdAt: message.createdAt }, undefined, 201);
}
