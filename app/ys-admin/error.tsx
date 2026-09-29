"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ys-admin]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-sm space-y-3 p-7 text-center">
        <p className="text-xl font-bold">Something went wrong</p>
        <p className="text-sm text-neutral-500">
          The console hit an unexpected error. Your data is safe — try again.
        </p>
        <div className="flex justify-center gap-2">
          <Button onClick={reset} className="bg-ali-red text-white hover:bg-ali-red-dark">
            Try again
          </Button>
          <Button variant="outline" asChild>
            <Link href="/ys-admin">Console home</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
