"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/lib/store/session";
import { toast } from "sonner";

export default function SellingOnboardingPage() {
  const [store, setStore] = useState("My Awesome Store");
  const becomeSeller = useSession((s) => s.becomeSeller);
  const router = useRouter();

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-xl font-bold">Start selling on ys-commerce</h1>
      <Card className="space-y-3 p-4">
        <p className="text-sm text-neutral-500">One account for buying + selling (eBay model). UI mock — backend verification later.</p>
        <Input value={store} onChange={(e) => setStore(e.target.value)} placeholder="Store name" />
        <Input placeholder="Business email (mock)" />
        <Button
          className="w-full bg-ali-red text-white hover:bg-ali-red-dark"
          onClick={() => {
            becomeSeller(store);
            toast.success(`Welcome, ${store}!`);
            router.push("/selling/dashboard");
          }}
        >
          Open my store
        </Button>
      </Card>
    </div>
  );
}
