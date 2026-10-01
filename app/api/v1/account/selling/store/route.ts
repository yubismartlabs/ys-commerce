import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { audit } from "@/lib/api/guard";
import { isSuspended } from "@/lib/api/identity";
import { describeImagePolicy, isAllowedImageUrl } from "@/lib/images";
import { checkUsername, normalizeUsername, usernameErrorMessage } from "@/lib/usernames";
import { findHandleOwner, getReservedUsernames, getStoreUsernameMaxChanges } from "@/lib/usernames-server";

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
  // Public @handle (canonical URL /store/@username). Renames are capped for
  // life — see storeUsernameMaxChanges. The legacy slug is immutable and only
  // serves old /store/<slug> links (redirected to the @ URL).
  username: z.string().trim().min(1).max(30).optional(),
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

/** Update own store profile (commission stays admin-controlled). */
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

  const { username: rawUsername, ...profile } = parsed.data;

  // Store @handle rename: format + reserved + shared-namespace unique, then
  // the lifetime cap. Unchanged-or-blank means "keep".
  let username: string | undefined;
  const wantUsername = rawUsername !== undefined ? normalizeUsername(rawUsername) : "";
  if (wantUsername !== "" && wantUsername !== normalizeUsername(store.username)) {
    const reserved = await getReservedUsernames();
    const checked = checkUsername(wantUsername, reserved);
    if (!checked.ok) {
      const code = checked.reason === "RESERVED" ? "RESERVED" : "VALIDATION";
      return fail(code, usernameErrorMessage(checked.reason), 422);
    }
    const taken = await findHandleOwner(checked.value, { storeId: store.id });
    if (taken) return fail("CONFLICT", "That store username is taken. Try another one.", 409);
    const maxChanges = await getStoreUsernameMaxChanges();
    if (store.usernameChangeCount >= maxChanges) {
      return fail(
        "FORBIDDEN",
        maxChanges === 0
          ? "Store usernames can't be changed once chosen."
          : `You've used all ${maxChanges} store username ${maxChanges === 1 ? "change" : "changes"}.`,
        403
      );
    }
    username = checked.value;
  }

  const [updated] = await db.$transaction([
    db.store.update({
      where: { id: store.id },
      data: {
        ...profile,
        ...(username !== undefined
          ? { username, usernameChangeCount: { increment: 1 } }
          : {}),
      },
    }),
  ]);
  const maxChanges = await getStoreUsernameMaxChanges();
  await audit(userId, "store.profile", "Store", store.id, {
    via: "seller",
    ...(username !== undefined && username !== normalizeUsername(store.username)
      ? { usernameFrom: store.username, usernameTo: username }
      : {}),
  });
  return ok({
    ...updated,
    usernameChangesRemaining: Math.max(0, maxChanges - updated.usernameChangeCount),
  });
}
