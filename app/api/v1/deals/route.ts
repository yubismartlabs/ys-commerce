import { db } from "@/lib/db";
import { getPagination, ok } from "@/lib/api/http";

/** Live + upcoming flash deals for the deals page (no auth). */
export async function GET(req: Request) {
  const now = new Date();
  const { page, pageSize, skip } = getPagination(new URL(req.url));
  const where = {
    status: { in: ["SCHEDULED", "ACTIVE"] as never },
    endsAt: { gt: now },
  };
  const [total, deals] = await Promise.all([
    db.deal.count({ where }),
    db.deal.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { startsAt: "asc" },
      include: {
        product: {
          select: {
            slug: true, title: true, image: true, price: true, compareAt: true,
            ratingAvg: true, ratingCount: true, soldCount: true, badge: true, freeShipping: true,
          },
        },
      },
    }),
  ]);
  const rows = deals.map((d) => {
    const live = d.status === "ACTIVE" && d.startsAt <= now && (d.stockCap === null || d.soldCount < d.stockCap);
    return {
      ...d,
      dealPrice: Number(d.dealPrice),
      live,
      progress: d.stockCap ? Math.min(1, d.soldCount / d.stockCap) : null,
    };
  });
  return ok(rows, { page, pageSize, total });
}
