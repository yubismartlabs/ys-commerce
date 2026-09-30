import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";

const bodySchema = z.object({
  messageId: z.string().min(1).max(64),
  // +1 helpful, -1 not helpful. Same value twice clears the vote.
  value: z.union([z.literal(1), z.literal(-1)]),
});

/** Thumbs up/down on an assistant answer. Ownership-checked; votes tune future replies. */
export async function POST(req: Request) {
  const session = await auth().catch(() => null);
  const userId = session?.user ? (session.user as { id: string }).id : null;
  if (!userId) return fail("UNAUTHORIZED", "Sign in to use the shopping assistant.", 401);

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION", parsed.error.issues[0]?.message ?? "Invalid payload", 422);

  const row = await db.aiMessage.findUnique({ where: { id: parsed.data.messageId }, select: { userId: true, role: true, feedback: true } });
  if (!row || row.userId !== userId || row.role !== "ASSISTANT") {
    return fail("NOT_FOUND", "Message not found.", 404);
  }
  const feedback = row.feedback === parsed.data.value ? null : parsed.data.value;
  await db.aiMessage.update({ where: { id: parsed.data.messageId }, data: { feedback } });
  return ok({ messageId: parsed.data.messageId, feedback });
}
