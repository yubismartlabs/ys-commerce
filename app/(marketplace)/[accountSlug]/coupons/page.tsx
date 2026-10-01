"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountCoupons } from "@/components/coupons/account-coupons";
import { SellerCoupons } from "@/components/coupons/seller-coupons";
import { useAccountBase } from "@/lib/account-url";

/** Unified coupons: redeemable codes + my store's coupons. */
export default function AccountCouponsPage() {
  const base = useAccountBase();
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold">Coupons</h2>
      <Tabs defaultValue="available">
        <TabsList>
          <TabsTrigger value="available">Available codes</TabsTrigger>
          <TabsTrigger value="store">My store coupons</TabsTrigger>
        </TabsList>
        <TabsContent value="available" className="space-y-3">
          <p className="text-sm text-neutral-500">Currently-redeemable codes. Enter one at checkout.</p>
          <Card className="p-6">
            <AccountCoupons />
          </Card>
        </TabsContent>
        <TabsContent value="store">
          <Card className="p-4">
            <SellerCoupons />
          </Card>
          <p className="pt-2 text-xs text-neutral-500">
            No store yet? <Button variant="link" size="sm" asChild className="h-auto p-0 text-xs"><Link href={`${base}/start-selling`}>Open a store</Link></Button> — anyone can list.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
