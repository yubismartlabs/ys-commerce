"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/refine/ui";
import { formatUSD, timeAgo } from "@/lib/format";
import { MessageButton } from "@/components/chat/message-button";
import type { Order, OrderItem } from "@/lib/refine/types";

type SellerDetail = Order & { sellerItems: OrderItem[] };

async function fetchOrder(id: string): Promise<SellerDetail> {
  const res = await fetch(`/api/v1/selling/orders/${id}`);
  if (!res.ok) throw new Error("Order not found.");
  return (await res.json()).data as SellerDetail;
}

export default function SellingOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["selling-order", id], queryFn: () => fetchOrder(id), retry: false });
  const [tracking, setTracking] = useState("");
  const [carrier, setCarrier] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const o = query.data;

  const go = async (status: "SHIPPED" | "DELIVERED") => {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/selling/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          ...(tracking ? { trackingNumber: tracking } : {}),
          ...(carrier ? { carrier } : {}),
          ...(note ? { note } : {}),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Update failed.");
      toast.success(status === "SHIPPED" ? "Marked as shipped." : "Marked as delivered.");
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["selling-order", id] });
      queryClient.invalidateQueries({ queryKey: ["selling-orders"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  };

  if (query.isLoading) return <Card className="p-6 text-sm text-neutral-500">Loading order…</Card>;
  if (query.isError || !o) {
    return (
      <Card className="space-y-2 p-6 text-sm text-neutral-500">
        <p>Order not found or none of your items are in it.</p>
        <Button size="sm" variant="outline" asChild><Link href="/selling/orders">Back to orders</Link></Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild className="gap-1">
        <Link href="/selling/orders"><ArrowLeft className="size-4" /> Orders</Link>
      </Button>
      <Card className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-mono text-xl font-bold">{o.number}</h1>
          <StatusBadge value={o.status} />
          <span className="text-xs text-neutral-400">placed {timeAgo(o.createdAt)}</span>
          <span className="ml-auto"><MessageButton orderId={o.id} label="Message buyer" basePath="/selling/messages" /></span>
        </div>

        <div>
          <p className="text-sm font-bold">My items ({o.sellerItems.reduce((a, i) => a + i.qty, 0)})</p>
          <div className="mt-1 divide-y">
            {o.sellerItems.map((i) => (
              <div key={i.id} className="flex items-center gap-3 py-2">
                <p className="min-w-0 flex-1 truncate text-sm">{i.title}{i.variant ? <span className="text-neutral-400"> · {i.variant}</span> : null}</p>
                <p className="text-sm tabular-nums text-neutral-500">×{i.qty}</p>
                <p className="w-20 text-right text-sm font-semibold tabular-nums">{formatUSD(i.price)}</p>
              </div>
            ))}
          </div>
        </div>

        <Separator />
        <div className="text-sm">
          <p className="font-bold">Ship to</p>
          <p className="mt-1">{o.shipName ?? "—"}{o.shipPhone ? ` · ${o.shipPhone}` : ""}</p>
          <p className="text-neutral-500">{o.shipStreet ?? "—"}, {o.shipCity ?? "—"} {o.shipZip ?? ""}</p>
          {(o.trackingNumber || o.carrier) ? (
            <p className="mt-2 font-mono text-xs">Tracking: {o.trackingNumber ?? "—"}{o.carrier ? ` via ${o.carrier}` : ""}</p>
          ) : null}
        </div>

        {(o.status === "PAID" || o.status === "SHIPPED") && (
          <>
            <Separator />
            <div className="grid gap-2 sm:grid-cols-2">
              <Input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Tracking number" className="font-mono" />
              <Input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="Carrier" />
            </div>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the buyer (optional)" rows={2} />
            <div className="flex flex-wrap gap-2">
              {o.status === "PAID" ? (
                <Button disabled={busy} onClick={() => go("SHIPPED")} className="bg-ali-red text-white hover:bg-ali-red-dark">
                  {busy ? <Loader2 className="size-4 animate-spin" /> : null} Mark shipped
                </Button>
              ) : null}
              {o.status === "SHIPPED" ? (
                <>
                  <Button disabled={busy || !tracking} variant="outline" onClick={() => go("SHIPPED")}>
                    Update tracking
                  </Button>
                  <Button disabled={busy} onClick={() => go("DELIVERED")} className="bg-ali-red text-white hover:bg-ali-red-dark">
                    {busy ? <Loader2 className="size-4 animate-spin" /> : null} Mark delivered
                  </Button>
                </>
              ) : null}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
