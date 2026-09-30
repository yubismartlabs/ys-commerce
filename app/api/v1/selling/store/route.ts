import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { audit } from "@/lib/api/guard";
import { isSuspended } from "@/lib/api/identity";
import { describeImagePolicy, isAllowedImageUrl } from "@/lib/images";

async function ownStores(userId: string) {
  return db.store.findMany({ where: { ownerId: userId }, orderBy: { createdAt: "asc" } });
}

/** Seller's own store(s) with profile fields. */
export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const stores = await ownStores(userId);
  if (id) {
    const store = stores.find((s) => s.id === id);
    if (!store) return fail("NOT_FOUND", "Store not found", 404);
    return ok(store);
  }
  return ok(stores);
}

const profileSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(2000).nullable().optional(),
  logo: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .optional()
    .refine((v) => v == null || v === "" || isAllowedImageUrl(v), { message: `Logo: ${describeImagePolicy()}` }),
  banner: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .optional()
    .refine((v) => v == null || v === "" || isAllowedImageUrl(v), { message: `Banner: ${describeImagePolicy()}` }),
  shippingPolicy: z.string().max(2000).nullable().optional(),
  returnPolicy: z.string().max(2000).nullable().optional(),
  announcement: z.string().max(300).nullable().optional(),
});

/** Update own store profile (slug + commission stay admin-controlled). */
export async function PATCH(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);
  if (await isSuspended(userId)) return fail("SUSPENDED", "This account is suspended", 403);

  const parsed = profileSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION", parsed.error.issues[0]?.message ?? "Invalid profile", 422);

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const stores = await ownStores(userId);
  // A multi-store seller must name the target: silently defaulting to the
  // oldest store would write one storefront's profile onto another.
  if (!id && stores.length > 1) {
    return fail("VALIDATION", "Multiple stores — pass ?id=<storeId> to pick which one to update", 422);
  }
  const store = id ? stores.find((s) => s.id === id) : stores[0];
  if (!store) return fail("NOT_FOUND", "Store not found", 404);

  const updated = await db.store.update({ where: { id: store.id }, data: parsed.data });
  await audit(userId, "store.profile", "Store", store.id, { via: "seller" });
  return ok(updated);
}
