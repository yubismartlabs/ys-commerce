import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fail, getPagination, ok } from "@/lib/api/http";
import { isSuspended } from "@/lib/api/identity";

/**
 * Public product Q&A.
 *
 * Deliberately NOT chat. Chat is end-to-end encrypted and private to the two
 * parties, so one buyer's answer can't help the next buyer. Pre-purchase
 * questions ("is this really 3.5mm?", "does it ship to Canada?") need a
 * shared, indexable thread that every later visitor benefits from.
 */

const askSchema = z.object({
  body: z.string().trim().min(10, "Ask a little more — at least 10 characters").max(1000),
});

/** Public read. Hidden (seller-reported) questions never appear. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await db.product.findUnique({
    where: { slug },
    select: { id: true, status: true, store: { select: { id: true, name: true } } },
  });
  if (!product || product.status !== "ACTIVE") return fail("NOT_FOUND", "Product not found", 404);

  const { page, pageSize, skip } = getPagination(req instanceof Request ? new URL(req.url) : new URL("http://x"));
  const where = { productId: product.id, hidden: false };
  const [total, questions] = await Promise.all([
    db.productQuestion.count({ where }),
    db.productQuestion.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        author: { select: { id: true, name: true } },
        answers: {
          orderBy: [{ fromSeller: "desc" }, { createdAt: "asc" }],
          include: { author: { select: { id: true, name: true } } },
        },
      },
    }),
  ]);

  const session = await auth().catch(() => null);
  const userId = session?.user?.id ?? null;

  return ok(
    {
      storeName: product.store.name,
      questions: questions.map((q) => ({
        ...q,
        // Tell the client whether this viewer may delete their own question.
        mine: !!userId && q.authorId === userId,
      })),
    },
    { page, pageSize, total }
  );
}

/** Ask a question. One per product per buyer — it's a shared thread, not a DM. */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in to ask a question", 401);
  if (await isSuspended(userId)) return fail("SUSPENDED", "This account is suspended", 403);

  const { slug } = await params;
  const parsed = askSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail("VALIDATION", parsed.error.issues[0]?.message ?? "Invalid question", 422);
  }

  const product = await db.product.findUnique({
    where: { slug },
    select: { id: true, status: true, storeId: true },
  });
  if (!product || product.status !== "ACTIVE") return fail("NOT_FOUND", "Product not found", 404);

  const existing = await db.productQuestion.findUnique({
    where: { productId_authorId: { productId: product.id, authorId: userId } },
  });
  if (existing) {
    return fail("CONFLICT", "You've already asked a question on this product — add an answer instead.", 409);
  }

  const question = await db.productQuestion.create({
    data: {
      productId: product.id,
      storeId: product.storeId,
      authorId: userId,
      body: parsed.data.body,
    },
  });
  return ok(question, undefined, 201);
}
