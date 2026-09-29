import { db } from "@/lib/db";

export type ActiveDeal = {
  id: string;
  productId: string;
  dealPrice: number;
  endsAt: Date;
  stockCap: number | null;
  soldCount: number;
};

/** Live deal for a product, or null (window closed, capped, or not ACTIVE). */
export async function getActiveDeal(productId: string): Promise<ActiveDeal | null> {
  const now = new Date();
  const deal = await db.deal.findUnique({ where: { productId } });
  if (!deal || deal.status !== "ACTIVE") return null;
  if (deal.startsAt > now || deal.endsAt <= now) return null;
  if (deal.stockCap !== null && deal.soldCount >= deal.stockCap) return null;
  return { ...deal, dealPrice: Number(deal.dealPrice) };
}

/** Effective base price: deal price wins while a deal is live. */
export function effectiveBasePrice(base: number, deal: Pick<ActiveDeal, "dealPrice"> | null): number {
  return deal ? Number(deal.dealPrice) : base;
}

/** Current buyable base price for a product id + its DB base price. */
export async function currentPrice(productId: string, base: number): Promise<{ price: number; deal: ActiveDeal | null }> {
  const deal = await getActiveDeal(productId);
  return { price: effectiveBasePrice(base, deal), deal };
}
