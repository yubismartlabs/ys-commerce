import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { ApiError } from "@/lib/api/guard";
import { requireUser } from "@/lib/api/identity";

const schema = z.object({
  lifecycle: z.boolean().optional(),
  priceAlerts: z.boolean().optional(),
});

/** Buyer reads/updates their own lifecycle email preferences. */
export async function GET() {
  let actor;
  try {
    actor = await requireUser();
  } catch (e) {
    if (e instanceof ApiError) return fail(e.code, e.message, e.status);
    throw e;
  }
  const user = await db.user.findUnique({ where: { id: actor.id }, select: { prefs: true } });
  const prefs = (user?.prefs ?? {}) as Record<string, unknown>;
  return ok({ lifecycle: prefs.lifecycle !== false, priceAlerts: prefs.priceAlerts !== false });
}

export async function PATCH(req: Request) {
  let actor;
  try {
    actor = await requireUser();
  } catch (e) {
    if (e instanceof ApiError) return fail(e.code, e.message, e.status);
    throw e;
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION", "Invalid preferences", 422);
  const user = await db.user.findUnique({ where: { id: actor.id }, select: { prefs: true } });
  const merged = { ...((user?.prefs ?? {}) as Record<string, unknown>), ...parsed.data };
  await db.user.update({ where: { id: actor.id }, data: { prefs: merged } });
  return ok({ lifecycle: merged.lifecycle !== false, priceAlerts: merged.priceAlerts !== false });
}
