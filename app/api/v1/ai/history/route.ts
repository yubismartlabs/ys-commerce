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
  // citations is either a legacy product array or { products, orders }.
  const split = (c: unknown): { products: unknown[]; orders: unknown[] } => {
    if (Array.isArray(c)) return { products: c, orders: [] };
    if (c && typeof c === "object") {
      const o = c as { products?: unknown; orders?: unknown };
      return {
        products: Array.isArray(o.products) ? o.products : [],
        orders: Array.isArray(o.orders) ? o.orders : [],
      };
    }
    return { products: [], orders: [] };
  };
  return ok(
    rows.map((r) => {
      const { products, orders } = split(r.citations);
      return {
        id: r.id,
        role: r.role === "USER" ? "user" : "assistant",
        content: r.content,
        citations: products,
        orders,
        feedback: r.feedback,
        createdAt: r.createdAt,
      };
    })
  );
}

/** Clear the buyer's assistant thread (new chat). */
export async function DELETE() {
  const session = await auth().catch(() => null);
  const userId = session?.user ? (session.user as { id: string }).id : null;
  if (!userId) return fail("UNAUTHORIZED", "Sign in to use the shopping assistant.", 401);

  const { count } = await db.aiMessage.deleteMany({ where: { userId } });
  return ok({ cleared: count });
}
