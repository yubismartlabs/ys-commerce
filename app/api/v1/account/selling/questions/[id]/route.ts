import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { isSuspended } from "@/lib/api/identity";

const answerSchema = z.object({
  body: z.string().trim().min(2, "Answer is too short").max(1000),
});

const patchSchema = z.object({
  hidden: z.boolean().optional(),
  delete: z.literal(true).optional(),
});

async function ownStoreIds(userId: string): Promise<string[]> {
  const stores = await db.store.findMany({ where: { ownerId: userId }, select: { id: true } });
  return stores.map((s) => s.id);
}

/**
 * Answer a question. The seller (or their staff) answers are badged
 * `fromSeller` so buyers can weight them; the asker can also follow up.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);
  if (await isSuspended(userId)) return fail("SUSPENDED", "This account is suspended", 403);

  const { id } = await params;
  const parsed = answerSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION", parsed.error.issues[0]?.message ?? "Invalid answer", 422);

  const question = await db.productQuestion.findUnique({
    where: { id },
    select: { id: true, storeId: true, authorId: true, product: { select: { slug: true, title: true } } },
  });
  if (!question) return fail("NOT_FOUND", "Question not found", 404);

  const storeIds = await ownStoreIds(userId);
  const isSeller = storeIds.includes(question.storeId);
  const isQuestionAuthor = question.authorId === userId;
  if (!isSeller && !isQuestionAuthor) return fail("FORBIDDEN", "You can only answer your own question.", 403);

  const answer = await db.productAnswer.create({
    data: { questionId: id, authorId: userId, body: parsed.data.body, fromSeller: isSeller },
  });
  return ok({ answer, question: question.product }, undefined, 201);
}

/**
 * Moderation. A seller HIDES a question (the thread and its answers stay, the
 * buyer can't tell); only the asker may DELETE their own.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION", "Provide { hidden: boolean } or { delete: true }", 422);

  const { id } = await params;
  const question = await db.productQuestion.findUnique({ where: { id }, select: { authorId: true, storeId: true } });
  if (!question) return fail("NOT_FOUND", "Question not found", 404);

  const storeIds = await ownStoreIds(userId);
  const isSeller = storeIds.includes(question.storeId);
  const isAuthor = question.authorId === userId;
  if (!isSeller && !isAuthor) return fail("FORBIDDEN", "Not your question.", 403);

  if (parsed.data.delete) {
    if (!isAuthor) return fail("FORBIDDEN", "Sellers should hide a question, not delete it.", 403);
    await db.productQuestion.delete({ where: { id } });
    return ok({ deleted: true });
  }

  if (parsed.data.hidden === undefined) return fail("VALIDATION", "Nothing to update", 422);
  if (!isSeller) return fail("FORBIDDEN", "Only the seller can hide a question.", 403);

  const updated = await db.productQuestion.update({ where: { id }, data: { hidden: parsed.data.hidden } });
  return ok(updated);
}
