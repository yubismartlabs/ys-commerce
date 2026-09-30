import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api/http";
import { audit } from "@/lib/api/guard";
import { validateCoupon } from "@/lib/coupons/engine";
import { cartLineSchema, generateOrderNumber, resolveCart, shippingForLines } from "@/lib/coupons/cart";
import { createHoldsForOrder } from "@/lib/escrow/escrow";
import { isSuspended } from "@/lib/api/identity";
import { notifyAdmins } from "@/lib/notifications/notify";

const addressSchema = z.object({
  name: z.string().min(2).max(80),
  phone: z.string().max(30).optional(),
  street: z.string().min(3).max(120),
  city: z.string().min(2).max(80),
  zip: z.string().min(3).max(20),
});

const schema = z.object({
  items: z.array(cartLineSchema).min(1).max(50),
  couponCode: z.string().min(1).max(32).optional(),
  address: addressSchema,
});

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Real checkout (mock payment = PAID): validates the coupon server-side,
 * creates the order + items, records redemption and decrements variant stock.
 */
export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("UNAUTHORIZED", "Sign in to check out", 401);
  if (await isSuspended(userId)) return fail("SUSPENDED", "This account is suspended", 403);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("VALIDATION", "items[], couponCode and a shipping address are required", 422);

  let lines;
  try {
    lines = await resolveCart(parsed.data.items);
  } catch (e) {
    return fail("VALIDATION", e instanceof Error ? e.message : "Invalid cart", 422);
  }
  const subtotal = round(lines.reduce((a, l) => a + l.price * l.qty, 0));
  const { byStore: shippingByStore, total: shipping } = await shippingForLines(lines);

  let coupon: { id: string; code: string } | null = null;
  let discount = 0;
  let shippingDiscount = 0;
  if (parsed.data.couponCode?.trim()) {
    const v = await validateCoupon({
      code: parsed.data.couponCode,
      items: lines,
      shipping,
      shippingByStore: Object.fromEntries(shippingByStore),
      userId,
    });
    if (!v.ok) return fail("COUPON", v.error, 422);
    coupon = { id: v.coupon.id, code: v.coupon.code };
    discount = v.discount;
    shippingDiscount = v.shippingDiscount;
  }
  const shippingFinal = round(Math.max(0, shipping - shippingDiscount));
  const total = round(Math.max(0, subtotal - discount + shippingFinal));
  const number = await generateOrderNumber();
  const storeIds = [...new Set(lines.map((l) => l.storeId))];

  let orderId: string;
  try {
    const order = await db.$transaction(async (tx) => {
      // Re-check caps inside the transaction (closes the validate→redeem race).
      if (coupon) {
        const fresh = await tx.coupon.findUnique({ where: { id: coupon.id } });
        if (!fresh || !fresh.active) throw new Error("COUPON:This code is no longer active.");
        if (fresh.maxUses !== null && fresh.usedCount >= fresh.maxUses) {
          throw new Error("COUPON:This code just reached its usage limit.");
        }
        if (fresh.perUserLimit !== null) {
          const mine = await tx.couponRedemption.count({ where: { couponId: fresh.id, userId } });
          if (mine >= fresh.perUserLimit) throw new Error("COUPON:You've already used this code.");
        }
      }
      // Variant stock check + decrement. A cart line that names a variant must
      // match one exactly: silently skipping an unmatched line (the old `if (v)`)
      // let a renamed/typo'd variant sell with no stock check at all.
      const variantLines = lines.filter((l) => l.variant);
      if (variantLines.length > 0) {
        const variants = await tx.productVariant.findMany({
          where: { productId: { in: [...new Set(variantLines.map((l) => l.productId))] } },
        });
        for (const l of variantLines) {
          const v = variants.find((x) => x.productId === l.productId && x.name === l.variant);
          if (!v) {
            throw new Error(`VARIANT:${l.title} is no longer available in "${l.variant}". Pick another option.`);
          }
          if (v.stock < l.qty) throw new Error(`STOCK:Only ${v.stock} left of ${l.title} (${v.name}).`);
          await tx.productVariant.update({ where: { id: v.id }, data: { stock: v.stock - l.qty } });
        }
      }
      const created = await tx.order.create({
        data: {
          number,
          buyerId: userId,
          status: "PAID",
          subtotal,
          shipping: shippingFinal,
          discount,
          couponCode: coupon?.code,
          total,
          shipName: parsed.data.address.name,
          shipPhone: parsed.data.address.phone,
          shipStreet: parsed.data.address.street,
          shipCity: parsed.data.address.city,
          shipZip: parsed.data.address.zip,
          items: {
            create: lines.map((l) => ({
              productId: l.productId,
              storeId: l.storeId,
              title: l.title,
              image: l.image,
              price: l.price,
              qty: l.qty,
              variant: l.variant,
            })),
          },
        },
        include: { items: true },
      });

      // One parcel per store. This is what makes a multi-seller basket honest:
      // the buyer sees N parcels with N tracking numbers, and each store's
      // shipping is charged and attributed to that store alone.
      const storeIds = [...new Set(created.items.map((i) => i.storeId))];
      const shipmentByStore = new Map<string, string>();
      for (const storeId of storeIds) {
        const shipment = await tx.shipment.create({
          data: {
            orderId: created.id,
            storeId,
            status: "PENDING",
            shippingCost: shippingByStore.get(storeId) ?? 0,
          },
        });
        shipmentByStore.set(storeId, shipment.id);
      }
      for (const item of created.items) {
        const shipmentId = shipmentByStore.get(item.storeId);
        if (shipmentId) {
          await tx.orderItem.update({ where: { id: item.id }, data: { shipmentId } });
        }
      }

      // Lock the seller's net per line in escrow (released after protection).
      await createHoldsForOrder(tx, {
        orderId: created.id,
        lines: created.items.map((i) => ({
          orderItemId: i.id,
          storeId: i.storeId,
          lineTotal: Number(i.price) * i.qty,
        })),
        discountRatio: subtotal > 0 ? discount / subtotal : 0,
      });
      if (coupon) {
        await tx.couponRedemption.create({
          data: { couponId: coupon.id, userId, orderId: created.id, amount: discount },
        });
        await tx.coupon.update({ where: { id: coupon.id }, data: { usedCount: { increment: 1 } } });
      }
      for (const l of lines) {
        await tx.product.update({ where: { id: l.productId }, data: { soldCount: { increment: l.qty } } });
      }
      // Flash-deal cap accounting (units sold per deal product).
      const qtyByProduct = new Map<string, number>();
      for (const l of lines) qtyByProduct.set(l.productId, (qtyByProduct.get(l.productId) ?? 0) + l.qty);
      for (const [productId, qty] of qtyByProduct) {
        await tx.deal.updateMany({
          where: { productId, status: "ACTIVE" },
          data: { soldCount: { increment: qty } },
        });
      }
      const qtyByStore = new Map<string, number>();
      for (const l of lines) qtyByStore.set(l.storeId, (qtyByStore.get(l.storeId) ?? 0) + l.qty);
      for (const [storeId, qty] of qtyByStore) {
        await tx.store.update({ where: { id: storeId }, data: { soldCount: { increment: qty } } });
      }
      await tx.orderEvent.createMany({
        data: [
          { orderId: created.id, type: "CREATED", actorId: userId },
          {
            orderId: created.id,
            type: "PAID",
            message: coupon ? `Paid with coupon ${coupon.code} (−$${discount.toFixed(2)}).` : "Paid (mock payment).",
            actorId: userId,
          },
        ],
      });
      return created;
    });
    orderId = order.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Checkout failed";
    if (msg.startsWith("COUPON:")) return fail("COUPON", msg.slice(7), 422);
    if (msg.startsWith("STOCK:")) return fail("STOCK", msg.slice(6), 422);
    if (msg.startsWith("VARIANT:")) return fail("VARIANT", msg.slice(8), 422);
    console.error("[checkout] failed", msg);
    return fail("CHECKOUT", "Checkout failed, please retry", 500);
  }

  await audit(userId, "order.create", "Order", orderId, {
    number,
    total,
    coupon: coupon?.code,
    parcels: storeIds.length,
  });
  await notifyAdmins({
    type: "order.created",
    title: `New order ${number} — $${total.toFixed(2)}`,
    body: coupon ? `Coupon ${coupon.code} applied (−$${discount.toFixed(2)}).` : undefined,
    link: `/ys-admin/orders/show/${orderId}`,
    meta: { entityId: orderId, orderNumber: number },
  });
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: true, shipments: { include: { store: { select: { id: true, name: true, slug: true } } } } },
  });
  return ok(order, undefined, 201);
}
