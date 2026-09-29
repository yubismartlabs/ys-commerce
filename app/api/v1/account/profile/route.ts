import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { ApiError } from "@/lib/api/guard";
import { requireUser } from "@/lib/api/identity";

const schema = z.object({ name: z.string().min(1).max(80) });

/** Update your own display name. */
export async function PATCH(req: Request) {
  let actor;
  try {
    actor = await requireUser();
  } catch (e) {
    if (e instanceof ApiError) return fail(e.code, e.message, e.status);
    throw e;
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION", "Name (1-80 chars) required", 422);
  const updated = await db.user.update({ where: { id: actor.id }, data: { name: parsed.data.name } });
  return ok({ id: updated.id, name: updated.name, email: updated.email });
}
