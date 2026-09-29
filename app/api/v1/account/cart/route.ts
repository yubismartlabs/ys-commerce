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
});

const schema = z.object({ items: z.array(lineSchema).max(50) });

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
