import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { clientKey, limit } from "@/lib/api/rate-limit";
import { ApiError } from "@/lib/api/guard";
import { requireUser } from "@/lib/api/identity";
import { getSettingGroup } from "@/lib/server-settings";

const schema = z.object({
  current: z.string().min(1).max(128),
  next: z.string().min(8).max(128),
});

/** Change your own password (verifies the current one). */
export async function POST(req: Request) {
  let actor;
  try {
    actor = await requireUser();
  } catch (e) {
    if (e instanceof ApiError) return fail(e.code, e.message, e.status);
    throw e;
  }
  // Throttled after authentication, keyed on the account: the caller already
  // holds a valid session but must still present the current password, so this
  // is a guessing target with a known username.
  const rl = await limit(clientKey(req, "password", actor.id), 10, 15 * 60 * 1000);
  if (!rl.ok) {
    return fail("RATE_LIMITED", "Too many attempts. Try again later.", 429, {
      retryAfterSeconds: rl.retryAfterSeconds,
    });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION", "Current and new password (8+ chars) required", 422);

  const security = await getSettingGroup("security");
  if (parsed.data.next.length < security.passwordMinLength) {
    return fail("VALIDATION", `New password must be ${security.passwordMinLength}+ characters`, 422);
  }

  const user = await db.user.findUnique({ where: { id: actor.id } });
  if (!user?.passwordHash || !(await bcrypt.compare(parsed.data.current, user.passwordHash))) {
    return fail("INVALID", "Current password is incorrect", 401);
  }
  await db.user.update({ where: { id: actor.id }, data: { passwordHash: await bcrypt.hash(parsed.data.next, 10) } });
  return ok({ changed: true });
}
