import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fail, getPagination, ok } from "@/lib/api/http";
import { storeBalance } from "@/lib/escrow/escrow";

/** Seller's own balance sheet + payout history across their stores. */
export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in required", 401);

  const stores = await db.store.findMany({ where: { ownerId: userId }, select: { id: true, name: true } });
  if (stores.length === 0) return ok({ stores: [], balance: null, payouts: [] });

  const { page, pageSize, skip } = getPagination(new URL(req.url));
  const storeIds = stores.map((s) => s.id);
  const [balances, total, payouts] = await Promise.all([
    Promise.all(stores.map(async (s) => ({ ...s, ...(await storeBalance(s.id)) }))),
    db.payout.count({ where: { storeId: { in: storeIds } } }),
    db.payout.findMany({
      where: { storeId: { in: storeIds } },
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: { store: { select: { name: true } } },
    }),
  ]);
  const totals = balances.reduce(
    (a, b) => ({ held: a.held + b.held, frozen: a.frozen + b.frozen, pendingPayout: a.pendingPayout + b.pendingPayout, paidLifetime: a.paidLifetime + b.paidLifetime }),
    { held: 0, frozen: 0, pendingPayout: 0, paidLifetime: 0 }
  );
  return ok({ stores: balances, balance: totals, payouts }, { page, pageSize, total });
}
