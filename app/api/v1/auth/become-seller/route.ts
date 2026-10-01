import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { getSettingGroup } from "@/lib/server-settings";
import { isSuspended } from "@/lib/api/identity";
import { notifySellerRequest } from "@/lib/notifications/notify";
import {
  baseUsernameFromName,
  checkUsername,
  normalizeUsername,
  usernameErrorMessage,
} from "@/lib/usernames";
import { ensureUniqueUsername, findHandleOwner, getReservedUsernames } from "@/lib/usernames-server";

const schema = z.object({
  storeName: z.string().min(2).max(80),
  // Custom handle — the ONLY place a user can claim one. Optional: when
  // omitted the auto-generated handle is kept.
  username: z.string().trim().min(1).max(30).optional(),
  // Public store @handle, shown as /store/@username. Chosen at creation;
  // renames later are capped for life (see storeUsernameMaxChanges).
  // Optional for backwards compat — auto-derived from the store name.
  storeUsername: z.string().trim().min(1).max(30).optional(),
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

  // Resolve the seller handle: custom claim (validated) or keep/auto-mint.
  // Claims are checked in the shared user+store namespace.
  const reserved = await getReservedUsernames();
  let username = user.username;
  if (parsed.data.username !== undefined && normalizeUsername(parsed.data.username) !== "") {
    const checked = checkUsername(parsed.data.username, reserved);
    if (!checked.ok) {
      const code = checked.reason === "RESERVED" ? "RESERVED" : "VALIDATION";
      return fail(code, usernameErrorMessage(checked.reason), 422);
    }
    const taken = await findHandleOwner(checked.value, { userId });
    if (taken) return fail("CONFLICT", usernameErrorMessage("TAKEN"), 409);
    username = checked.value;
  } else if (!username) {
    username = await ensureUniqueUsername(baseUsernameFromName(user.name, user.email), reserved, { userId });
  }

  // Resolve the store @handle: chosen at creation, or derived from the name.
  let storeUsername: string;
  if (parsed.data.storeUsername !== undefined && normalizeUsername(parsed.data.storeUsername) !== "") {
    const checked = checkUsername(parsed.data.storeUsername, reserved);
    if (!checked.ok) {
      const code = checked.reason === "RESERVED" ? "RESERVED" : "VALIDATION";
      return fail(code, `Store username: ${usernameErrorMessage(checked.reason)}`, 422);
    }
    const taken = await findHandleOwner(checked.value);
    if (taken) return fail("CONFLICT", "That store username is taken. Try another one.", 409);
    storeUsername = checked.value;
  } else {
    storeUsername = await ensureUniqueUsername(
      baseUsernameFromName(parsed.data.storeName, undefined),
      reserved
    );
  }

  const commerce = await getSettingGroup("commerce");
  // No role promotion: every account is a BUYER (or ADMIN). Owning a store
  // is what makes someone a seller — Store.ownerId, never User.role.
  const [store] = await db.$transaction([
    db.store.create({
      data: {
        name: parsed.data.storeName,
        slug: slugify(parsed.data.storeName),
        username: storeUsername,
        ownerId: userId,
        commissionRate: commerce.commissionDefault,
        // Honour the admin's seller-approval policy. "auto" (the default) lets
        // anyone list immediately, eBay-style; "manual" keeps the review queue.
        status: commerce.sellerApproval === "auto" ? "APPROVED" : "PENDING",
      },
    }),
    db.user.update({
      where: { id: userId },
      data: { username },
    }),
  ]);

  await db.auditLog.create({
    data: { actorId: userId, action: "store.create", entity: "Store", entityId: store.id },
  });

  // Auto-approved stores skip the admin queue; manual ones still notify so an
  // operator can review them.
  if (commerce.sellerApproval !== "auto") {
    await notifySellerRequest({
      storeId: store.id,
      storeName: store.name,
      ownerId: userId,
      ownerEmail: user.email,
    });
  }
  return ok({ ...store, username }, undefined, 201);
}
