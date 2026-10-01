import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { ApiError } from "@/lib/api/guard";
import { requireUser } from "@/lib/api/identity";
import { addressSchema, MAX_ADDRESSES } from "@/lib/addresses/schema";
import { assertUnderAddressLimit, clearDefaults, listAddresses, toRow } from "@/lib/addresses/server";

/** The signed-in buyer's address book, default first. */
export async function GET() {
  let actor;
  try {
    actor = await requireUser();
  } catch (e) {
    if (e instanceof ApiError) return fail(e.code, e.message, e.status);
    throw e;
  }
  const rows = await listAddresses(actor.id);
  return ok(rows, undefined, 200, { max: MAX_ADDRESSES });
}

/**
 * Add an address. The first one a buyer saves becomes the default
 * automatically — an address book where nothing is preselected at checkout
 * would just push that decision back at them every time.
 */
export async function POST(req: Request) {
  let actor;
  try {
    actor = await requireUser();
  } catch (e) {
    if (e instanceof ApiError) return fail(e.code, e.message, e.status);
    throw e;
  }

  const parsed = addressSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail("VALIDATION", parsed.error.issues[0]?.message ?? "Invalid address", 422);
  }

  if (!(await assertUnderAddressLimit(actor.id))) {
    return fail("CONFLICT", `You can save up to ${MAX_ADDRESSES} addresses. Delete one to add another.`, 409);
  }

  const existing = await db.address.count({ where: { userId: actor.id } });
  const row = toRow(parsed.data);

  // Promote and insert in one transaction: the partial unique index rejects a
  // second default, so clearing first is what keeps this safe.
  const created = await db.$transaction(async (tx) => {
    if (existing === 0) {
      await clearDefaults(actor.id, undefined, tx);
    }
    return tx.address.create({
      data: { ...row, userId: actor.id, isDefault: existing === 0 },
    });
  });

  return ok(created, undefined, 201);
}