import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { moveReturn, ReturnError } from "@/lib/returns/returns";

const patchSchema = z.object({
  to: z.enum(["CANCELLED"]),
  note: z.string().max(1000).optional(),
});

/** A single buyer return. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);

  const { id } = await params;
  const request = await db.returnRequest.findUnique({
    where: { id },
    include: {
      store: { select: { id: true, name: true, slug: true } },
      order: { select: { number: true, status: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!request || request.buyerId !== userId) return fail("NOT_FOUND", "Return not found.", 404);
  return ok(request);
}

/** Buyer may only withdraw a return while it's still open. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION", "Only { to: \"CANCELLED\" } is supported here", 422);

  const { id } = await params;
  try {
    const updated = await moveReturn({
      returnId: id,
      to: parsed.data.to,
      actorId: userId,
      actorRole: "BUYER",
    });
    return ok(updated);
  } catch (e) {
    if (e instanceof ReturnError) {
      const status = e.code === "NOT_FOUND" ? 404 : e.code === "FORBIDDEN" ? 403 : e.code === "CONFLICT" ? 409 : 422;
      return fail(e.code, e.message, status);
    }
    console.error("[returns] cancel failed:", e);
    return fail("RETURNS", "Couldn't cancel the return", 500);
  }
}
