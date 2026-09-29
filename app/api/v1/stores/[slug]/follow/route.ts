import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { notifyUser } from "@/lib/notifications/notify";

/** Follow a store (idempotent). */
export async function POST(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in to follow stores", 401);
  const { slug } = await params;

  const store = await db.store.findUnique({ where: { slug }, select: { id: true, name: true, status: true, ownerId: true } });
  if (!store || store.status !== "APPROVED") return fail("NOT_FOUND", "Store not found", 404);

  const existing = await db.storeFollow.findUnique({
    where: { storeId_userId: { storeId: store.id, userId } },
    select: { id: true },
  });
  if (existing) {
    const followers = await db.storeFollow.count({ where: { storeId: store.id } });
    return ok({ following: true, followers });
  }
  await db.$transaction([
    db.storeFollow.create({ data: { storeId: store.id, userId } }),
    db.store.update({ where: { id: store.id }, data: { followerCount: { increment: 1 } } }),
  ]);

  await notifyUser({
    userId: store.ownerId,
    type: "store.followed",
    title: `${store.name} gained a follower`,
    link: undefined,
  });
  const count = await db.storeFollow.count({ where: { storeId: store.id } });
  return ok({ following: true, followers: count }, undefined, 201);
}

/** Unfollow a store. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);
  const { slug } = await params;

  const store = await db.store.findUnique({ where: { slug }, select: { id: true } });
  if (!store) return fail("NOT_FOUND", "Store not found", 404);

  const existing = await db.storeFollow.findUnique({
    where: { storeId_userId: { storeId: store.id, userId } },
  });
  if (!existing) return ok({ following: false });
  await db.$transaction([
    db.storeFollow.delete({ where: { id: existing.id } }),
    db.store.update({ where: { id: store.id }, data: { followerCount: { decrement: 1 } } }),
  ]);
  const count = await db.storeFollow.count({ where: { storeId: store.id } });
  await db.store.update({ where: { id: store.id }, data: { followerCount: count } });
  return ok({ following: false, followers: count });
}
