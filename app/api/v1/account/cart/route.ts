import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";

const lineSchema = z.object({
  slug: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  image: z.string().max(500),
  price: z.number().min(0).max(1000000),
  qty: z.number().int().min(1).max(99),
  // Kept so a restored cart doesn't collapse multi-variant products into one
  // line (the cart store keys on slug + variant).
  variant: z.string().max(80).optional(),
});

const schema = z.object({ items: z.array(lineSchema).max(50) });

/**
 * Read the saved cart so the recovery email's link actually restores it.
 * Without this the snapshot was write-only and "you left items behind" pointed
 * at a cart the buyer could not get back.
 */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);

  const snapshot = await db.cartSnapshot.findUnique({ where: { userId } });
  const items = Array.isArray(snapshot?.items) ? (snapshot?.items as z.infer<typeof lineSchema>[]) : [];
  return ok(items, { page: 1, pageSize: items.length, total: items.length });
}

/**
 * Storefront cart mirror for abandoned-cart recovery. Signed-in buyers
 * only; empty carts delete the snapshot. Called debounced on cart change.
 */
export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION", "items[] required", 422);

  if (parsed.data.items.length === 0) {
    await db.cartSnapshot.deleteMany({ where: { userId } });
    return ok({ cleared: true });
  }
  await db.cartSnapshot.upsert({
    where: { userId },
    update: { items: parsed.data.items },
    create: { userId, items: parsed.data.items },
  });
  return ok({ saved: parsed.data.items.length });
}
