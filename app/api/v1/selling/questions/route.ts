import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";

/** Questions on the seller's own products, with answers. */
export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);

  const stores = await db.store.findMany({ where: { ownerId: userId }, select: { id: true } });
  const storeIds = stores.map((s) => s.id);
  if (storeIds.length === 0) return ok({ questions: [], unanswered: 0 });

  const slug = new URL(req.url).searchParams.get("slug");

  const questions = await db.productQuestion.findMany({
    where: { storeId: { in: storeIds }, ...(slug ? { product: { slug } } : {}) },
    orderBy: [{ hidden: "asc" }, { createdAt: "desc" }],
    take: 100,
    include: {
      product: { select: { slug: true, title: true } },
      author: { select: { id: true, name: true } },
      answers: {
        orderBy: [{ fromSeller: "desc" }, { createdAt: "asc" }],
        include: { author: { select: { id: true, name: true } } },
      },
    },
  });

  return ok({
    questions,
    unanswered: questions.filter((q) => q.answers.length === 0).length,
  });
}
