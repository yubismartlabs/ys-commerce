"use client";

import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountReturnsTab } from "@/components/returns/account-returns";
import { SellerReturns } from "@/components/returns/seller-returns";

/** Unified returns: my requests + requests on my store. */
export default function AccountReturnsPage() {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold">Returns</h2>
      <Tabs defaultValue="buying">
        <TabsList>
          <TabsTrigger value="buying">My requests</TabsTrigger>
          <TabsTrigger value="selling">Store requests</TabsTrigger>
        </TabsList>
        <TabsContent value="buying">
          <Card className="p-6"><AccountReturnsTab /></Card>
        </TabsContent>
        <TabsContent value="selling">
          <Card className="p-4"><SellerReturns /></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
