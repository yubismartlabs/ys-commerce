import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { ApiError } from "@/lib/api/guard";
import { requireUser } from "@/lib/api/identity";
import { getConversationFor } from "@/lib/chat/access";
import { publish } from "@/lib/chat/hub";

const schema = z.object({ messageId: z.string().min(1).optional() });

/** Mark the thread read (optionally up to a message). Broadcasts a seen-receipt. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let me;
  try {
    me = await requireUser();
  } catch (e) {
    if (e instanceof ApiError) return fail(e.code, e.message, e.status);
    throw e;
  }
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION", "Invalid payload", 422);

  const convo = await getConversationFor(me.id, id);
  if (!convo) return fail("NOT_FOUND", "Conversation not found", 404);

  let at = new Date();
  if (parsed.data.messageId) {
    const m = await db.chatMessage.findUnique({ where: { id: parsed.data.messageId }, select: { conversationId: true, createdAt: true } });
    if (!m || m.conversationId !== id) return fail("VALIDATION", "Message not in this conversation", 422);
    at = m.createdAt;
  }
  await db.conversationRead.upsert({
    where: { conversationId_userId: { conversationId: id, userId: me.id } },
    update: { lastReadAt: at },
    create: { conversationId: id, userId: me.id, lastReadAt: at },
  });
  publish(id, { type: "read", userId: me.id, at });
  return ok({ read: true });
}
