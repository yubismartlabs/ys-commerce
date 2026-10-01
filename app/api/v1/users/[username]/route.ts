import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { normalizeUsername } from "@/lib/usernames";

/**
 * Public seller profile by handle: user + approved stores + counts.
 * PII-free (no email). Follow state included when the viewer is signed in.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username: raw } = await params;
  const username = normalizeUsername(raw);
  const user = await db.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      name: true,
      image: true,
      role: true,
      createdAt: true,
      stores: {
        where: { status: "APPROVED" },
        select: {
          id: true,
          name: true,
          slug: true,
          username: true,
          logo: true,
          banner: true,
          description: true,
          ratingAvg: true,
          ratingCount: true,
          soldCount: true,
          followerCount: true,
          _count: { select: { products: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { reviews: true } },
    },
  });
  if (!user) return fail("NOT_FOUND", "User not found", 404);

  const storeIds = user.stores.map((s) => s.id);
  const [followerTotal, productTotal] = await Promise.all([
    storeIds.length > 0
      ? db.storeFollow.count({ where: { storeId: { in: storeIds } } })
      : Promise.resolve(0),
    storeIds.length > 0
      ? db.product.count({ where: { storeId: { in: storeIds }, status: "ACTIVE" } })
      : Promise.resolve(0),
  ]);

  let following: string[] = [];
  const session = await auth();
  const viewerId = session?.user?.id;
  if (viewerId && storeIds.length > 0) {
    const mine = await db.storeFollow.findMany({
      where: { userId: viewerId, storeId: { in: storeIds } },
      select: { storeId: true },
    });
    following = mine.map((m) => m.storeId);
  }

  return ok({ ...user, followerTotal, productTotal, following });
}
