"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** Boundary for everything below the root layout (marketplace + admin). */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-sm space-y-3 p-7 text-center">
        <p className="text-xl font-bold">Something went wrong</p>
        <p className="text-sm text-neutral-500">
          We couldn&apos;t load this page. Your cart and account are safe — try again.
        </p>
        <div className="flex justify-center gap-2">
          <Button onClick={reset} className="bg-ali-red text-white hover:bg-ali-red-dark">
            Try again
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">Homepage</Link>
          </Button>
        </div>
        {error.digest ? (
          <p className="text-[11px] text-neutral-400">Reference: {error.digest}</p>
        ) : null}
      </Card>
    </div>
  );
}
