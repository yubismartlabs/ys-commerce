import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountCoupons } from "@/components/coupons/account-coupons";
import { AccountDisputesTab } from "@/components/disputes/account-disputes";
import { AccountOrders } from "@/components/orders/account-orders";

export default function AccountPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">My YS (buyer + seller unified)</h1>
      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="disputes">Disputes</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          <TabsTrigger value="coupons">Coupons</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="orders"><Card className="px-6 py-2"><AccountOrders /></Card></TabsContent>
        <TabsContent value="disputes"><Card className="px-6 py-4"><AccountDisputesTab /></Card></TabsContent>
        <TabsContent value="reviews"><Card className="p-6 text-sm text-neutral-500">Reviews mock.</Card></TabsContent>
        <TabsContent value="coupons"><Card className="p-6"><AccountCoupons /></Card></TabsContent>
        <TabsContent value="settings"><Card className="p-6 text-sm text-neutral-500">Addresses, language EN, currency USD.</Card></TabsContent>
      </Tabs>
    </div>
  );
}
