import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fail, getPagination, ok } from "@/lib/api/http";

/** Stores the signed-in buyer follows (for My YS → Following). */
export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);

  const url = new URL(req.url);
  const { page, pageSize, skip } = getPagination(url);
  const where = { userId };
  const [total, rows] = await Promise.all([
    db.storeFollow.count({ where }),
    db.storeFollow.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            slug: true,
            username: true,
            logo: true,
            ratingAvg: true,
            ratingCount: true,
            followerCount: true,
            status: true,
          },
        },
      },
    }),
  ]);
  return ok(
    rows.map((r) => ({ ...r.store, followedAt: r.createdAt })),
    { page, pageSize, total }
  );
}
