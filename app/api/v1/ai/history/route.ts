import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { getAiConfig } from "@/lib/ai/config";

/** Thread history for the drawer (newest last, capped). Signed-in only. */
export async function GET() {
  const session = await auth().catch(() => null);
  const userId = session?.user ? (session.user as { id: string }).id : null;
  if (!userId) return fail("UNAUTHORIZED", "Sign in to use the shopping assistant.", 401);

  const cfg = await getAiConfig();
  if (!cfg.enabled) return fail("DISABLED", "Shopping assistant is off.", 503);

  const rows = await db.aiMessage.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, role: true, content: true, citations: true, feedback: true, createdAt: true },
    take: 40,
  });
  return ok(
    rows.map((r) => ({
      id: r.id,
      role: r.role === "USER" ? "user" : "assistant",
      content: r.content,
      citations: Array.isArray(r.citations) ? r.citations : [],
      feedback: r.feedback,
      createdAt: r.createdAt,
    }))
  );
}
