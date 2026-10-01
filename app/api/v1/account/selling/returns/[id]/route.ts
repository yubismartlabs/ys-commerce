import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { moveReturn, ReturnError } from "@/lib/returns/returns";

const patchSchema = z.object({
  to: z.enum(["ACCEPTED", "REJECTED", "RECEIVED"]),
  note: z.string().max(1000).optional(),
});

/**
 * Seller responds to a return on their own store.
 *
 * Deliberately cannot set REFUNDED: the money only moves after support
 * confirms the item came back, otherwise a seller could self-serve a refund
 * and keep the goods.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION", "to must be ACCEPTED, REJECTED or RECEIVED", 422);

  const { id } = await params;
  const storeIds = (await db.store.findMany({ where: { ownerId: userId }, select: { id: true } })).map((s) => s.id);

  try {
    const updated = await moveReturn({
      returnId: id,
      to: parsed.data.to,
      actorId: userId,
      actorRole: "SELLER",
      sellerStoreIds: storeIds,
      ...(parsed.data.note ? { sellerNote: parsed.data.note } : {}),
    });
    return ok(updated);
  } catch (e) {
    if (e instanceof ReturnError) {
      const status = e.code === "NOT_FOUND" ? 404 : e.code === "FORBIDDEN" ? 403 : e.code === "CONFLICT" ? 409 : 422;
      return fail(e.code, e.message, status);
    }
    console.error("[selling/returns] update failed:", e);
    return fail("RETURNS", "Couldn't update the return", 500);
  }
}

/** Seller view of one return. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);

  const { id } = await params;
  const storeIds = (await db.store.findMany({ where: { ownerId: userId }, select: { id: true } })).map((s) => s.id);
  const request = await db.returnRequest.findUnique({
    where: { id },
    include: {
      order: { select: { number: true, status: true, shipName: true, shipLine1: true, shipLine2: true, shipCity: true, shipRegion: true, shipPostalCode: true, shipCountry: true } },
      buyer: { select: { email: true, name: true } },
      store: { select: { id: true, name: true, slug: true } },
    },
  });
  if (!request || !storeIds.includes(request.storeId)) {
    return fail("NOT_FOUND", "Return not found.", 404);
  }
  return ok(request);
}
