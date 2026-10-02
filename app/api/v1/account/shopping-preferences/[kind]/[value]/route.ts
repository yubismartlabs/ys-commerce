import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { ApiError } from "@/lib/api/guard";
import { requireUser } from "@/lib/api/identity";
import { PREFERENCE_KINDS, normalizeValue } from "@/lib/shopping-preferences";

const paramsSchema = z.object({
  kind: z.enum(PREFERENCE_KINDS),
  value: z.string().min(1).max(60),
});

/**
 * Drop one saved size or brand.
 *
 * Keyed by the value rather than a row id so the chip can delete itself, and
 * compared case-insensitively for the same reason the unique index is: a chip
 * labelled "Nike" must remove the row stored as "Nike" regardless of how the
 * buyer typed it.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ kind: string; value: string }> }) {
  let actor;
  try {
    actor = await requireUser();
  } catch (e) {
    if (e instanceof ApiError) return fail(e.code, e.message, e.status);
    throw e;
  }

  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return fail("VALIDATION", "Unknown preference", 422);

  const target = normalizeValue(parsed.data.kind, parsed.data.value).toLowerCase();
  // Resolved in JS rather than with `mode: "insensitive"`, which Prisma does
  // not support on every connector — and comparing the whole row here is what
  // stops "Nike" from also deleting "Nike Air".
  const rows = await db.shoppingPreference.findMany({
    where: { userId: actor.id, kind: parsed.data.kind },
    select: { id: true, value: true },
  });
  const match = rows.find((r) => r.value.toLowerCase() === target);
  if (!match) return ok({ removed: 0 });

  await db.shoppingPreference.delete({ where: { id: match.id } });
  return ok({ removed: 1 });
}