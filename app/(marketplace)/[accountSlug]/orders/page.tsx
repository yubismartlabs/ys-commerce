"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountOrders } from "@/components/orders/account-orders";
import { SellerOrders } from "@/components/orders/seller-orders";
import { useAccountBase } from "@/lib/account-url";

/**
 * Unified orders: Buying (purchase history) + Selling (fulfillment).
 * ?view=selling deep-links from notifications and the sales detail page.
 */
function OrdersTabs() {
  const base = useAccountBase();
  const search = useSearchParams();
  const router = useRouter();
  const view = search.get("view") === "selling" ? "selling" : "buying";

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold">Orders</h2>
      <Tabs value={view} onValueChange={(v) => router.replace(v === "selling" ? `${base}/orders?view=selling` : `${base}/orders`, { scroll: false })}>
        <TabsList>
          <TabsTrigger value="buying">Buying</TabsTrigger>
          <TabsTrigger value="selling">Selling</TabsTrigger>
        </TabsList>
        <TabsContent value="buying">
          <Card className="px-6 py-2"><AccountOrders /></Card>
        </TabsContent>
        <TabsContent value="selling">
          <Card className="p-4"><SellerOrders /></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function AccountOrdersPage() {
  return (
    <Suspense fallback={<Card className="p-6 text-sm text-neutral-500">Loading orders…</Card>}>
      <OrdersTabs />
    </Suspense>
  );
}
