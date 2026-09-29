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
import { evaluateMessage } from "@/lib/chat/safety";
import { open, seal } from "@/lib/chat/server-crypto";

async function actor() {
  try {
    return await requireUser();
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw e;
  }
}

export type MessageView = {
  id: string;
  senderId: string;
  text: string;
  imageUrl: string | null;
  replyToId: string | null;
  flagged: boolean;
  createdAt: string;
};

function toView(m: {
  id: string;
  senderId: string;
  ciphertext: string;
  nonce: string;
  keyId: string;
  imageUrl: string | null;
  replyToId: string | null;
  flagged: boolean;
  createdAt: Date;
}): MessageView {
  let text = "⚠ Message unavailable.";
  try {
    text = open({ ciphertext: m.ciphertext, nonce: m.nonce, keyId: m.keyId });
  } catch {
    // Unknown/rotated-away key: row stays sealed rather than crashing the feed.
  }
  return {
    id: m.id,
    senderId: m.senderId,
    text,
    imageUrl: m.imageUrl,
    replyToId: m.replyToId,
    flagged: m.flagged,
    createdAt: m.createdAt.toISOString(),
  };
}

/** Plaintext feed (opened server-side) for participants. */
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
    db.chatMessage.findMany({ where, skip, take: pageSize, orderBy: { createdAt: "asc" } }),
  ]);
  return ok(messages.map(toView), { page, pageSize, total });
}

const postSchema = z.object({
  text: z.string().max(2000).optional(),
  replyToId: z.string().optional(),
  imageUrl: z.string().max(500).optional(),
}).refine((v) => (v.text?.trim() ? true : !!v.imageUrl), { message: "text or image required" });

/**
 * Send a message: screened for PII/circumvention (blocked), flagged for
 * abuse (allowed, queued for moderation), sealed at rest. Trust & safety
 * can read content — stated in the thread UI.
 */
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
  if (!parsed.success) return fail("VALIDATION", parsed.error.issues[0]?.message ?? "text or image required", 422);

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

  const text = (parsed.data.text ?? "").trim();
  let flagged = false;
  let flaggedKinds: string[] = [];
  if (text) {
    const screen = evaluateMessage(text);
    if (screen.level === "block") return fail("PROTECTION", screen.message ?? "Content blocked", 422);
    if (screen.level === "warn") {
      flagged = true;
      flaggedKinds = [...new Set(screen.hits.map((h) => h.kind))];
    }
  }

  const sealed = seal(text);
  const message = await db.$transaction(async (tx) => {
    const m = await tx.chatMessage.create({
      data: {
        conversationId: id,
        senderId: me.id,
        ciphertext: sealed.ciphertext,
        nonce: sealed.nonce,
        keyId: sealed.keyId,
        replyToId: parsed.data.replyToId,
        imageUrl: parsed.data.imageUrl,
        flagged,
        flaggedKinds,
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

  publish(id, {
    type: "message",
    id: message.id,
    senderId: me.id,
    text: text || null,
    imageUrl: parsed.data.imageUrl ?? null,
    createdAt: message.createdAt,
  });

  // Nudge with a snippet (platform-readable by design). Never blocks.
  const peerId = convo.buyerId === me.id ? convo.sellerId : convo.buyerId;
  const peer = await db.user.findUnique({ where: { id: peerId }, select: { role: true, email: true } });
  if (peer) {
    const config = await getEmailConfig();
    const prefs = await buyerPrefs(peerId);
    const snippet = text ? (text.length > 140 ? `${text.slice(0, 140)}…` : text) : "📷 Photo";
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const link = peer.role === "BUYER" ? `/account/messages/${id}` : `/selling/messages/${id}`;
    await notifyUser({
      userId: peerId,
      type: "chat.message",
      title: "New message",
      body: convo.type === "ORDER" ? `${snippet}` : `${convo.subject ?? "Product inquiry"} — ${snippet}`,
      link,
      meta: { entityId: id },
      email: {
        template: {
          subject: `[${config.siteName}] New message`,
          html: `<p><strong>New message${convo.subject ? ` about ${esc(convo.subject)}` : ""}:</strong></p><p>${esc(snippet)}</p>`,
          text: `New message: ${snippet}`,
        },
        name: "chat.message",
        enabled: config.enabled && prefs.chat,
      },
    });
  }
  return ok(toView({ ...message, flagged, createdAt: message.createdAt }), undefined, 201);
}
