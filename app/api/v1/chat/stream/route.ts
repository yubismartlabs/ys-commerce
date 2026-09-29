import { auth } from "@/auth";
import { getConversationFor } from "@/lib/chat/access";
import { subscribe } from "@/lib/chat/hub";

export const dynamic = "force-dynamic";

/**
 * Server-sent events for one conversation: message / read / typing / notice
 * / rekey. Same-origin cookie session (EventSource sends cookies).
 * Single-instance hub — sticky sessions or a bus before scaling out.
 */
export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return new Response(JSON.stringify({ error: { code: "UNAUTHORIZED" } }), { status: 401 });
  }
  const conversationId = new URL(req.url).searchParams.get("conversationId");
  if (!conversationId) {
    return new Response(JSON.stringify({ error: { code: "VALIDATION" } }), { status: 422 });
  }
  const convo = await getConversationFor(userId, conversationId);
  if (!convo) {
    return new Response(JSON.stringify({ error: { code: "NOT_FOUND" } }), { status: 404 });
  }

  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  const stream = new ReadableStream({
    start(controller) {
      unsubscribe = subscribe(conversationId, controller);
      controller.enqueue(`event: hello\ndata: {"conversationId":"${conversationId}"}\n\n`);
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(`: ping\n\n`);
        } catch {
          // closed below
        }
      }, 25000);
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe?.();
    },
  });
  // Note: hub is module-scoped (single instance). See lib/chat/hub.ts.
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
