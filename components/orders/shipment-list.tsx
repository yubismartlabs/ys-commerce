"use client";

import Image from "next/image";
import Link from "next/link";
import { Package, Truck } from "lucide-react";
import { StatusBadge } from "@/components/refine/ui";
import { formatUSD, timeAgo } from "@/lib/format";
import type { ShipmentView } from "@/lib/refine/types";

const LABEL: Record<string, string> = {
  PENDING: "Preparing",
  IN_TRANSIT: "In transit",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

/**
 * Parcels for one order.
 *
 * A multi-seller basket ships as separate parcels with separate tracking, so
 * "Shipped" on the order is meaningless without showing them. Single-seller
 * orders render the same component with one entry.
 */
export function ShipmentList({
  shipments,
  items = [],
  backHref,
}: {
  shipments: ShipmentView[];
  items?: Array<{ id: string; title: string; qty: number; image: string; shipmentId?: string | null }>;
  backHref?: string;
}) {
  if (shipments.length === 0) return null;

  const byShipment = new Map<string, typeof items>();
  for (const item of items) {
    const key = item.shipmentId ?? "__none";
    byShipment.set(key, [...(byShipment.get(key) ?? []), item]);
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <Package className="size-4 text-neutral-500" />
        <h2 className="text-sm font-bold">
          {shipments.length === 1 ? "Shipment" : `${shipments.length} parcels`}
        </h2>
        {shipments.length > 1 ? (
          <span className="text-xs text-neutral-500">from {shipments.length} sellers</span>
        ) : null}
      </div>

      <ul className="space-y-2">
        {shipments.map((s) => {
          const lines = byShipment.get(s.id) ?? [];
          return (
            <li key={s.id} className="rounded-xl border bg-white p-3 dark:bg-neutral-900">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge value={s.status} />
                <span className="text-sm font-medium">{s.store?.name ?? "Store"}</span>
                <span className="text-xs text-neutral-500">{LABEL[s.status] ?? s.status}</span>
                {s.store?.slug ? (
                  <Link href={`/store/${s.store.slug}`} className="text-xs text-ali-red hover:underline">
                    Visit store
                  </Link>
                ) : null}
                <span className="ml-auto text-xs text-neutral-500">
                  {formatUSD(Number(s.shippingCost))} shipping
                </span>
              </div>

              {(s.trackingNumber || s.carrier) && (
                <p className="mt-1.5 flex items-center gap-1.5 font-mono text-xs">
                  <Truck className="size-3.5 shrink-0 text-neutral-400" />
                  {s.carrier ? `${s.carrier} ` : ""}
                  <span>{s.trackingNumber}</span>
                </p>
              )}
              {s.deliveredAt ? (
                <p className="text-[11px] text-neutral-500">Delivered {timeAgo(s.deliveredAt)}</p>
              ) : s.shippedAt ? (
                <p className="text-[11px] text-neutral-500">Shipped {timeAgo(s.shippedAt)}</p>
              ) : null}

              {lines.length > 0 ? (
                <ul className="mt-2 space-y-1.5">
                  {lines.map((l) => (
                    <li key={l.id} className="flex items-center gap-2">
                      <span className="relative size-10 shrink-0 overflow-hidden rounded bg-neutral-100">
                        <Image src={l.image} alt="" fill sizes="40px" className="object-cover" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs text-neutral-600 dark:text-neutral-300">
                        {l.title} × {l.qty}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {backHref ? (
                <p className="mt-2 text-[11px] text-neutral-400">
                  Questions about this parcel?{" "}
                  <Link href={backHref} className="underline">
                    contact the seller
                  </Link>
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
