"use client";

import { use, useState } from "react";
import { useShow, useUpdate } from "@refinedev/core";
import Image from "next/image";
import { Check, MapPin, Package, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { BackLink, ErrorState, Field, SectionTitle, StatusBadge, TableSkeleton } from "@/components/refine/ui";
import { toast } from "sonner";
import { formatUSD, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Order } from "@/lib/refine/types";

const STEPS = ["PENDING", "PAID", "SHIPPED", "DELIVERED"] as const;

// Mirrors lib/orders/transitions TRANSITIONS (client-safe copy).
const NEXT: Record<string, string[]> = {
  PENDING: ["PAID", "CANCELLED"],
  PAID: ["SHIPPED", "CANCELLED", "REFUNDED"],
  SHIPPED: ["DELIVERED", "REFUNDED"],
  DELIVERED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

const ACTION_LABEL: Record<string, string> = {
  PAID: "Mark paid",
  SHIPPED: "Mark shipped",
  DELIVERED: "Mark delivered",
  CANCELLED: "Cancel order",
  REFUNDED: "Refund order",
};

function Timeline({ order }: { order: Order }) {
  const events = order.events ?? [];
  if (events.length === 0) return <p className="mt-2 text-sm text-neutral-500">No timeline yet.</p>;
  return (
    <ol className="mt-3 space-y-0">
      {events.map((e, i) => (
        <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
          {i < events.length - 1 ? <span className="absolute left-[5px] top-4 h-full w-px bg-neutral-200 dark:bg-neutral-700" /> : null}
          <span className={cn(
            "mt-1 size-[11px] shrink-0 rounded-full",
            e.type === "NOTE" ? "bg-neutral-300 dark:bg-neutral-600" : "bg-emerald-500"
          )} />
          <div className="min-w-0">
            <p className="text-sm">
              <Badge variant="outline" className="mr-2 font-mono text-[10px]">{e.type}</Badge>
              <span className="text-neutral-500">{e.message ?? ""}</span>
            </p>
            <p className="text-xs text-neutral-400">{timeAgo(e.createdAt)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function OrderShowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { query } = useShow<Order>({ resource: "orders", id });
  const { mutate, mutation } = useUpdate();
  const [tracking, setTracking] = useState("");
  const [carrier, setCarrier] = useState("");
  const [note, setNote] = useState("");
  const o = query.data?.data;
  const busy = mutation.isPending;

  if (query.isLoading) return (<><BackLink href="/ys-admin/orders" label="Orders" /><Card className="p-0"><TableSkeleton rows={6} cols={2} /></Card></>);
  if (query.isError || !o) return (<><BackLink href="/ys-admin/orders" label="Orders" /><Card className="p-0"><ErrorState message="Order not found." /></Card></>);

  const stepIdx = STEPS.indexOf(o.status as (typeof STEPS)[number]);
  const done = stepIdx >= 0 ? stepIdx + 1 : 0;
  const next = NEXT[o.status] ?? [];

  const go = (values: Record<string, unknown>, okMsg: string) =>
    mutate({ resource: "orders", id, values }, {
      onSuccess: () => { toast.success(okMsg); setNote(""); },
      onError: (e) => toast.error((e as { message?: string })?.message ?? "Update failed."),
    });

  return (
    <div className="space-y-4">
      <BackLink href="/ys-admin/orders" label="Orders" />
      <Card className="p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-mono text-xl font-bold">Order {o.number}</h1>
          <StatusBadge value={o.status} />
          <span className="text-xs text-neutral-400">placed {timeAgo(o.createdAt)}</span>
          <span className="ml-auto text-2xl font-black tabular-nums">{formatUSD(o.total)}</span>
        </div>

        {(o.status === "REFUNDED" || o.status === "CANCELLED") ? null : (
          <div className="mt-5 flex items-center">
            {STEPS.map((s, i) => (
              <div key={s} className={cn("flex items-center", i < STEPS.length - 1 && "flex-1")}>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "flex size-6 items-center justify-center rounded-full text-[11px] font-bold",
                    i < done ? "bg-emerald-500 text-white" : "bg-neutral-200 text-neutral-500 dark:bg-neutral-700"
                  )}>
                    {i < done ? <Check className="size-3.5" /> : i + 1}
                  </span>
                  <span className={cn("hidden text-xs font-medium sm:block", i < done ? "" : "text-neutral-400")}>{s}</span>
                </div>
                {i < STEPS.length - 1 ? <span className={cn("mx-2 h-px flex-1", i < done - 1 ? "bg-emerald-500" : "bg-neutral-200 dark:bg-neutral-700")} /> : null}
              </div>
            ))}
          </div>
        )}

        <Separator className="my-5" />
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <SectionTitle><span className="inline-flex items-center gap-1.5"><User className="size-4" /> Buyer</span></SectionTitle>
            <dl className="mt-2 space-y-1.5 text-sm">
              <Field label="Name">{o.buyer?.name ?? "—"}</Field>
              <Field label="Email">{o.buyer?.email ?? "—"}</Field>
            </dl>
            <div className="mt-4">
              <SectionTitle><span className="inline-flex items-center gap-1.5"><MapPin className="size-4" /> Ship to</span></SectionTitle>
              <p className="mt-2 text-sm">
                {o.shipName ?? "—"}{o.shipPhone ? ` · ${o.shipPhone}` : ""}
                <br />
                <span className="text-neutral-500">
                  {o.shipStreet ?? "—"}, {o.shipCity ?? "—"} {o.shipZip ?? ""}
                </span>
              </p>
            </div>
          </div>
          <div>
            <SectionTitle>
              <span className="inline-flex items-center gap-1.5">
                <Package className="size-4" /> Fulfillment
                {(o.shipments ?? []).length > 1 ? ` (${o.shipments?.length} parcels)` : ""}
              </span>
            </SectionTitle>
            {(o.shipments ?? []).length === 0 ? (
              <p className="mt-2 text-sm text-neutral-500">No parcels recorded.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {(o.shipments ?? []).map((s) => (
                  <li key={s.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge value={s.status} />
                      <span className="font-medium">{s.store?.name ?? s.storeId}</span>
                      <span className="text-xs text-neutral-500">{s._count?.items ?? 0} items</span>
                      <span className="ml-auto text-xs text-neutral-500">{formatUSD(Number(s.shippingCost))} ship</span>
                    </div>
                    <dl className="mt-1.5 space-y-1">
                      <Field label="Carrier">{s.carrier || "—"}</Field>
                      <Field label="Tracking">
                        {s.trackingNumber ? <span className="font-mono">{s.trackingNumber}</span> : "—"}
                      </Field>
                      <Field label="Shipped">{s.shippedAt ? timeAgo(s.shippedAt) : "—"}</Field>
                      <Field label="Delivered">{s.deliveredAt ? timeAgo(s.deliveredAt) : "—"}</Field>
                    </dl>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <Separator className="my-5" />
        <SectionTitle>Items ({o.items.reduce((a, i) => a + i.qty, 0)})</SectionTitle>
        <div className="mt-2 divide-y">
          {o.items.map((i) => (
            <div key={i.id} className="flex items-center gap-3 py-2.5">
              <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                <Image src={i.image} alt="" fill sizes="44px" className="object-cover" />
              </span>
              <p className="line-clamp-2 min-w-0 flex-1 text-sm">{i.title}{i.variant ? <span className="text-neutral-400"> · {i.variant}</span> : null}</p>
              <p className="shrink-0 text-sm tabular-nums text-neutral-500">×{i.qty}</p>
              <p className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums">{formatUSD(i.price)}</p>
            </div>
          ))}
        </div>

        <Separator className="my-5" />
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between text-neutral-500"><dt>Subtotal</dt><dd className="tabular-nums">{formatUSD(o.subtotal)}</dd></div>
          <div className="flex justify-between text-neutral-500"><dt>Shipping</dt><dd className="tabular-nums">{formatUSD(o.shipping)}</dd></div>
          {(o.discount ?? 0) > 0 ? (
            <div className="flex justify-between text-emerald-600"><dt>Coupon {o.couponCode}</dt><dd className="tabular-nums">−{formatUSD(o.discount ?? 0)}</dd></div>
          ) : null}
          <div className="flex justify-between font-bold"><dt>Total ({o.currency})</dt><dd className="tabular-nums">{formatUSD(o.total)}</dd></div>
        </dl>

        {next.length > 0 ? (
          <>
            <Separator className="my-5" />
            <SectionTitle>Advance order</SectionTitle>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Tracking number (for SHIPPED)" className="font-mono" />
              <Input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="Carrier (e.g. USPS)" />
            </div>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the buyer / timeline (optional)" rows={2} className="mt-2" />
            <div className="flex flex-wrap gap-2 pt-3">
              {/* Editing tracking in place is a SHIPPED→SHIPPED transition.
                  The old guard was `next.includes("SHIPPED")`, but NEXT.SHIPPED
                  is ["DELIVERED","REFUNDED"] — it can never include "SHIPPED",
                  so this button never rendered and the trackingOnly branch in
                  lib/orders/transitions had no reachable UI. */}
              {o.status === "SHIPPED" ? (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => go({ status: "SHIPPED", ...(tracking ? { trackingNumber: tracking } : {}), ...(carrier ? { carrier } : {}), ...(note ? { note } : {}) }, "Tracking updated.")}>
                  Update tracking
                </Button>
              ) : null}
              {next.filter((s) => !(s === "SHIPPED" && o.status === "SHIPPED")).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={s === "CANCELLED" || s === "REFUNDED" ? "destructive" : s === "DELIVERED" || s === "PAID" ? "default" : "outline"}
                  disabled={busy}
                  onClick={() => go({
                    status: s,
                    ...(s === "SHIPPED" ? { ...(tracking ? { trackingNumber: tracking } : {}), ...(carrier ? { carrier } : {}) } : {}),
                    ...(note ? { note } : {}),
                  }, `${ACTION_LABEL[s] ?? s} done.`)}
                >
                  {ACTION_LABEL[s] ?? s}
                </Button>
              ))}
              <Button size="sm" variant="ghost" disabled={busy || !note} onClick={() => go({ note }, "Note added.")}>
                Add note only
              </Button>
            </div>
          </>
        ) : null}

        <Separator className="my-5" />
        <SectionTitle>Timeline</SectionTitle>
        <Timeline order={o} />
      </Card>
    </div>
  );
}
