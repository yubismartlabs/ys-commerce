import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { getSettingGroup } from "@/lib/server-settings";
import { isSuspended } from "@/lib/api/identity";
import { notifySellerRequest } from "@/lib/notifications/notify";

const schema = z.object({
  storeName: z.string().min(2).max(80),
});

function slugify(name: string): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "store";
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);
  if (await isSuspended(userId)) return fail("SUSPENDED", "This account is suspended", 403);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION", "Store name (2-80 chars) required", 422);

  const user = await db.user.findUnique({ where: { id: userId }, include: { stores: true } });
  if (!user) return fail("NOT_FOUND", "Account not found", 404);
  if (user.stores.length > 0) return fail("CONFLICT", "You already have a store", 409);

  const commerce = await getSettingGroup("commerce");
  const [store] = await db.$transaction([
    db.store.create({
      data: {
        name: parsed.data.storeName,
        slug: slugify(parsed.data.storeName),
        ownerId: userId,
        commissionRate: commerce.commissionDefault,
      },
    }),
    ...(user.role === "BUYER" ? [db.user.update({ where: { id: userId }, data: { role: "SELLER" } })] : []),
  ]);

  await db.auditLog.create({
    data: { actorId: userId, action: "store.create", entity: "Store", entityId: store.id },
  });

  // Alert all admins (in-app + email) about the new seller request.
  // Manual approval banks the store as PENDING; auto-approval is a later step.
  await notifySellerRequest({
    storeId: store.id,
    storeName: store.name,
    ownerId: userId,
    ownerEmail: user.email,
  });
  return ok(store, undefined, 201);
}
