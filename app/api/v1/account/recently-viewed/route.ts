import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { ApiError } from "@/lib/api/guard";
import { requireUser } from "@/lib/api/identity";
import { MAX_RECENT, listRecentViews } from "@/lib/products/recently-viewed";

/**
 * The signed-in buyer's browse history, newest first.
 *
 * Rows whose product has since been taken down or pulled from sale are kept in
 * the table (the unique key is the pair, and a listing can come back) but are
 * filtered out here — showing a buyer a card they cannot open is worse than
 * showing them a shorter list.
 */
export async function GET() {
  let actor;
  try {
    actor = await requireUser();
  } catch (e) {
    if (e instanceof ApiError) return fail(e.code, e.message, e.status);
    throw e;
  }

  const rows = await listRecentViews(actor.id);
  return ok(
    rows.filter((r) => r.product.status === "ACTIVE"),
    undefined,
    200,
    { max: MAX_RECENT }
  );
}

/** Clear the whole history — the privacy control the page links to. */
export async function DELETE() {
  let actor;
  try {
    actor = await requireUser();
  } catch (e) {
    if (e instanceof ApiError) return fail(e.code, e.message, e.status);
    throw e;
  }

  const { count } = await db.productView.deleteMany({ where: { userId: actor.id } });
  return ok({ cleared: count });
}