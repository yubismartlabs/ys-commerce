import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { ApiError } from "@/lib/api/guard";
import { requireUser } from "@/lib/api/identity";
import { pickSent } from "@/lib/api/patch";
import { addressPatchSchema, blankToNull } from "@/lib/addresses/schema";
import { clearDefaults } from "@/lib/addresses/server";

/**
 * 404 rather than 403 for someone else's address: a 403 would confirm the id
 * exists, letting any signed-in buyer enumerate the address book.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let actor;
  try {
    actor = await requireUser();
  } catch (e) {
    if (e instanceof ApiError) return fail(e.code, e.message, e.status);
    throw e;
  }
  const { id } = await params;
  const row = await db.address.findFirst({ where: { id, userId: actor.id } });
  if (!row) return fail("NOT_FOUND", "Address not found.", 404);
  return ok(row);
}

/**
 * Edit an address, or promote it to default with `{ isDefault: true }`.
 * A demotion (`false`) is honoured too: checkout then falls back to the
 * next-oldest row rather than leaving the buyer with no preselection.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let actor;
  try {
    actor = await requireUser();
  } catch (e) {
    if (e instanceof ApiError) return fail(e.code, e.message, e.status);
    throw e;
  }

  const { id } = await params;
  const existing = await db.address.findFirst({ where: { id, userId: actor.id } });
  if (!existing) return fail("NOT_FOUND", "Address not found.", 404);

  const body = await req.json().catch(() => null);
  const parsed = addressPatchSchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION", parsed.error.issues[0]?.message ?? "Invalid address", 422);
  }
  // Only keys the client actually sent: an omitted key must not blank a column.
  const sent = pickSent(parsed.data, body) as typeof parsed.data;

  const { isDefault, ...fields } = sent;
  const data: Record<string, unknown> = { ...fields };
  for (const k of ["label", "phone", "line2", "region"] as const) {
    if (k in data) data[k] = blankToNull(data[k] as string | null | undefined);
  }
  if (typeof data.country === "string") data.country = (data.country as string).toUpperCase();
  for (const k of ["name", "line1", "city", "postalCode"] as const) {
    if (typeof data[k] === "string") data[k] = (data[k] as string).trim();
  }

  const updated = await db.$transaction(async (tx) => {
    if (isDefault === true) await clearDefaults(actor.id, id, tx);
    if (Object.keys(data).length === 0 && isDefault !== true) {
      return existing;
    }
    return tx.address.update({ where: { id }, data: { ...data, ...(isDefault === true ? { isDefault: true } : {}) } });
  });

  return ok(updated);
}

/**
 * Delete an address. If it was the default, the next-oldest row is promoted so
 * checkout keeps a working preselection instead of an empty book.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let actor;
  try {
    actor = await requireUser();
  } catch (e) {
    if (e instanceof ApiError) return fail(e.code, e.message, e.status);
    throw e;
  }

  const { id } = await params;
  const existing = await db.address.findFirst({ where: { id, userId: actor.id } });
  if (!existing) return fail("NOT_FOUND", "Address not found.", 404);

  const remaining = await db.address.findMany({
    where: { userId: actor.id, NOT: { id } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  await db.$transaction(async (tx) => {
    await tx.address.delete({ where: { id } });
    if (existing.isDefault && remaining.length > 0) {
      await tx.address.update({ where: { id: remaining[0].id }, data: { isDefault: true } });
    }
  });

  return ok({ id, promoted: existing.isDefault && remaining.length > 0 ? remaining[0].id : null });
}