"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Marketplace boundary. `reset()` retries the failed render; the links cover
 * the two cases a shopper can actually act on.
 */
export default function MarketplaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[marketplace]", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Card className="w-full max-w-sm space-y-3 p-7 text-center">
        <p className="text-xl font-bold">We couldn&apos;t load this page</p>
        <p className="text-sm text-neutral-500">
          Something went wrong on our side. Your cart and account are untouched.
        </p>
        <div className="flex justify-center gap-2">
          <Button onClick={reset} className="bg-ali-red text-white hover:bg-ali-red-dark">
            Try again
          </Button>
          <Button variant="outline" asChild>
            <Link href="/search">Browse products</Link>
          </Button>
        </div>
        {error.digest ? (
          <p className="text-[11px] text-neutral-400">Reference: {error.digest}</p>
        ) : null}
      </Card>
    </div>
  );
}
