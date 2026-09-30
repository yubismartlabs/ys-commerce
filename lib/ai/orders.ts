import { db } from "@/lib/db";

export type BuyerOrderItem = { title: string; slug: string | null; qty: number; price: number };
export type BuyerShipment = { storeName: string; status: string; carrier: string | null; trackingNumber: string | null };
export type BuyerOrder = {
  number: string;
  status: string;
  total: number;
  createdAt: string;
  items: BuyerOrderItem[];
  shipments: BuyerShipment[];
};

const ORDER_WORDS = /(order|track|package|parcel|deliver|shipment|shipping|where.*(my|is)|arriv)/i;

/** Order questions get structured cards (Alexa-style "where is my order"). */
export function wantsOrderCard(text: string): boolean {
  return ORDER_WORDS.test(text);
}

export async function buyerOrders(userId: string, take = 3): Promise<BuyerOrder[]> {
  const orders = await db.order.findMany({
    where: { buyerId: userId },
    orderBy: { createdAt: "desc" },
    select: {
      number: true,
      status: true,
      total: true,
      createdAt: true,
      items: {
        select: {
          title: true,
          qty: true,
          price: true,
          product: { select: { slug: true } },
        },
        take: 5,
      },
      shipments: {
        select: {
          status: true,
          carrier: true,
          trackingNumber: true,
          store: { select: { name: true } },
        },
      },
    },
    take,
  });
  return orders.map((o) => ({
    number: o.number,
    status: o.status,
    total: Number(o.total),
    createdAt: new Date(o.createdAt).toISOString(),
    items: o.items.map((i) => ({ title: i.title, slug: i.product?.slug ?? null, qty: i.qty, price: Number(i.price) })),
    shipments: o.shipments.map((s) => ({
      storeName: s.store.name,
      status: s.status,
      carrier: s.carrier,
      trackingNumber: s.trackingNumber,
    })),
  }));
}
