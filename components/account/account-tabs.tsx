"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountCoupons } from "@/components/coupons/account-coupons";
import { AccountDisputesTab } from "@/components/disputes/account-disputes";
import { AccountOrders } from "@/components/orders/account-orders";
import { AccountReviewsTab } from "@/components/products/account-reviews";
import { AccountReturnsTab } from "@/components/returns/account-returns";
import { SecurityForm } from "@/components/account/security-form";

export const ACCOUNT_TABS = ["orders", "disputes", "returns", "reviews", "coupons", "settings"] as const;
export type AccountTab = (typeof ACCOUNT_TABS)[number];

export function isAccountTab(v: string | null | undefined): v is AccountTab {
  return !!v && (ACCOUNT_TABS as readonly string[]).includes(v);
}

export function AccountTabs({ initial }: { initial: AccountTab }) {
  const params = useSearchParams();
  const router = useRouter();
  // Tab lives in the URL so header/footer deep links (and browser history)
  // land on the right section instead of always resetting to "orders".
  const [tab, setTab] = useState<AccountTab>(initial);

  const onTabChange = (next: string) => {
    if (!isAccountTab(next)) return;
    setTab(next);
    router.replace(next === "orders" ? "/account" : `/account?tab=${next}`, { scroll: false });
  };

  // Keep in step with browser back/forward through ?tab= links.
  const fromUrl = params.get("tab");
  if (isAccountTab(fromUrl) && fromUrl !== tab) setTab(fromUrl);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">My YS (buyer + seller unified)</h1>
      <Tabs value={tab} onValueChange={onTabChange}>
        <TabsList>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="disputes">Disputes</TabsTrigger>
          <TabsTrigger value="returns">Returns</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          <TabsTrigger value="coupons">Coupons</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="orders"><Card className="px-6 py-2"><AccountOrders /></Card></TabsContent>
        <TabsContent value="disputes"><Card className="px-6 py-4"><AccountDisputesTab /></Card></TabsContent>
        <TabsContent value="returns"><Card className="p-6"><AccountReturnsTab /></Card></TabsContent>
        <TabsContent value="reviews"><Card className="p-6"><AccountReviewsTab /></Card></TabsContent>
        <TabsContent value="coupons"><Card className="p-6"><AccountCoupons /></Card></TabsContent>
        <TabsContent value="settings"><Card className="p-6"><SecurityForm /></Card></TabsContent>
      </Tabs>
    </div>
  );
}
