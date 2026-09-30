import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getPagination, serialize, fail, ok } from "@/lib/api/http";
import { ApiError, audit, requireAdmin } from "@/lib/api/guard";

/**
 * Console inbox. Any console user (full admin or staff with a scope) reads
 * only their own rows — area "any" matches the middleware gate.
 *
 * Previously used requireUser(), which accepted ANY signed-in account on an
 * admin-namespaced route. The row filter kept data contained, but the
 * classification was wrong and would have become a full cross-user read the
 * moment an admin-wide query was added. Buyer notifications live at
 * /api/v1/account/notifications.
 */
export async function GET(req: Request) {
  let actor;
  try {
    actor = await requireAdmin(req, "any");
  } catch (e) {
    if (e instanceof ApiError) return fail(e.code, e.message, e.status);
    throw e;
  }
  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  const unreadOnly = url.searchParams.get("unread") === "1";
  const { page, pageSize, skip } = getPagination(url);

  const where = {
    userId: actor.id,
    ...(type ? { type } : {}),
    ...(unreadOnly ? { readAt: null } : {}),
  };
  const [total, unreadCount, items] = await Promise.all([
    db.notification.count({ where }),
    db.notification.count({ where: { userId: actor.id, readAt: null } }),
    db.notification.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return NextResponse.json(
    serialize({ data: items, pagination: { page, pageSize, total }, unreadCount })
  );
}

const patchSchema = z.union([
  z.object({ ids: z.array(z.string()).min(1).max(100) }),
  z.object({ allRead: z.literal(true) }),
]);

export async function PATCH(req: Request) {
  let actor;
  try {
    actor = await requireAdmin(req, "any");
  } catch (e) {
    if (e instanceof ApiError) return fail(e.code, e.message, e.status);
    throw e;
  }
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION", "Provide { ids: [...] } or { allRead: true }", 422);

  const data = { readAt: new Date() };
  const updated =
    "ids" in parsed.data
      ? await db.notification.updateMany({ where: { userId: actor.id, id: { in: parsed.data.ids } }, data })
      : await db.notification.updateMany({ where: { userId: actor.id, readAt: null }, data });
  await audit(actor.id, "notifications.read", "Notification", "self", { count: updated.count });
  return ok({ read: updated.count });
}
