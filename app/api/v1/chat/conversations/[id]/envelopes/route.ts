import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { ApiError } from "@/lib/api/guard";
import { requireUser } from "@/lib/api/identity";
import { getConversationFor } from "@/lib/chat/access";
import { publish } from "@/lib/chat/hub";

const schema = z.object({
  wrappedKey: z.string().min(16).max(2000),
  ephemeralPub: z.string().min(16).max(300),
  nonce: z.string().min(8).max(64),
  keyVersion: z.number().int().min(1).default(1),
  userId: z.string().min(1),
});

/**
 * Publish a conversation-key envelope for a participant (initial key
 * exchange or re-keying a new device). The server stores the sealed
 * envelope — it can never unwrap it.
 */
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
  if (!parsed.success) return fail("VALIDATION", "wrappedKey, ephemeralPub, nonce, userId required", 422);

  const convo = await getConversationFor(me.id, id);
  if (!convo) return fail("NOT_FOUND", "Conversation not found", 404);
  if (parsed.data.userId !== convo.buyerId && parsed.data.userId !== convo.sellerId) {
    return fail("VALIDATION", "Envelope recipient must be a participant", 422);
  }
  const env = await db.keyEnvelope.upsert({
    where: {
      conversationId_userId_keyVersion: {
        conversationId: id,
        userId: parsed.data.userId,
        keyVersion: parsed.data.keyVersion,
      },
    },
    update: {
      wrappedKey: parsed.data.wrappedKey,
      ephemeralPub: parsed.data.ephemeralPub,
      nonce: parsed.data.nonce,
    },
    create: {
      conversationId: id,
      userId: parsed.data.userId,
      wrappedKey: parsed.data.wrappedKey,
      ephemeralPub: parsed.data.ephemeralPub,
      nonce: parsed.data.nonce,
      keyVersion: parsed.data.keyVersion,
    },
  });
  publish(id, { type: "rekey", userId: parsed.data.userId });
  return ok({ id: env.id }, undefined, 201);
}
