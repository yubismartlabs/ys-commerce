import { fail, ok } from "@/lib/api/http";
import { ApiError } from "@/lib/api/guard";
import { requireUser } from "@/lib/api/identity";
import { getConversationFor } from "@/lib/chat/access";
import { publish, rateLimited } from "@/lib/chat/hub";

/** Ephemeral typing heartbeat, relayed to the peer over SSE (not stored). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let me;
  try {
    me = await requireUser();
  } catch (e) {
    if (e instanceof ApiError) return fail(e.code, e.message, e.status);
    throw e;
  }
  if (rateLimited(`typing:${me.id}`)) return ok({ typing: false });
  const { id } = await params;
  const convo = await getConversationFor(me.id, id);
  if (!convo) return fail("NOT_FOUND", "Conversation not found", 404);
  if (convo.blockedById) return fail("FORBIDDEN", "This conversation is blocked", 403);
  publish(id, { type: "typing", userId: me.id });
  return ok({ typing: true });
}
