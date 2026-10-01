"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAccountUrl } from "@/lib/account-url";

function SuccessBody() {
  const a = useAccountUrl();
  const params = useSearchParams();
  const number = params.get("number");
  return (
    <Card className="mx-auto max-w-md space-y-4 p-8 text-center">
      <CheckCircle2 className="mx-auto size-12 text-emerald-500" />
      <h1 className="text-xl font-bold tracking-tight">Order placed</h1>
      {number ? (
        <p className="text-sm text-neutral-500">
          Order <span className="font-mono font-bold text-neutral-800 dark:text-neutral-200">{number}</span> is
          confirmed. A receipt was sent to your email.
        </p>
      ) : (
        <p className="text-sm text-neutral-500">Your order is confirmed.</p>
      )}
      <div className="flex flex-col gap-2">
        <Button asChild className="bg-ali-red text-white hover:bg-ali-red-dark">
          <Link href="/">Keep shopping</Link>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href={a("/orders")}>View my orders</Link>
        </Button>
      </div>
    </Card>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense>
      <SuccessBody />
    </Suspense>
  );
}
