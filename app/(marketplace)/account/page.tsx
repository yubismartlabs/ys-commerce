import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AccountPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">My YS (buyer + seller unified)</h1>
      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          <TabsTrigger value="coupons">Coupons</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="orders"><Card className="p-6 text-sm text-neutral-500">Orders list mock. Connects to custom backend later.</Card></TabsContent>
        <TabsContent value="reviews"><Card className="p-6 text-sm text-neutral-500">Reviews mock.</Card></TabsContent>
        <TabsContent value="coupons"><Card className="p-6 text-sm text-neutral-500">Coupons & coins mock.</Card></TabsContent>
        <TabsContent value="settings"><Card className="p-6 text-sm text-neutral-500">Addresses, language EN, currency USD.</Card></TabsContent>
      </Tabs>
    </div>
  );
}
