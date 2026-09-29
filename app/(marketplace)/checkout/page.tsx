import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function CheckoutPage() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <Card className="space-y-3 p-4">
          <p className="font-bold">Shipping address (USD / US mock)</p>
          <div className="grid gap-2 md:grid-cols-2">
            <Input placeholder="Full name" />
            <Input placeholder="Phone" />
            <Input placeholder="Street" className="md:col-span-2" />
            <Input placeholder="City" />
            <Input placeholder="ZIP" />
          </div>
        </Card>
        <Card className="space-y-2 p-4">
          <p className="font-bold">Payment (UI mock — Stripe later)</p>
          <div className="grid gap-2 md:grid-cols-2">
            <Input placeholder="Card number" />
            <Input placeholder="MM / YY" />
          </div>
        </Card>
      </div>
      <Card className="h-fit space-y-3 p-4">
        <p className="font-bold">Place order</p>
        <p className="text-sm text-neutral-500">Backend, tax, coupons and coins come later.</p>
        <Button className="w-full bg-ali-red text-white hover:bg-ali-red-dark">Pay now</Button>
      </Card>
    </div>
  );
}
