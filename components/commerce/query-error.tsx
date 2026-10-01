"use client";

import Link from "next/link";
import { Lock, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ApiClientError } from "@/lib/api/client";

function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiClientError && error.isUnauthorized;
}

function messageFor(error: unknown, fallback: string): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error && error.message && error.message !== "Failed to fetch") return error.message;
  return fallback;
}

/**
 * Error state for a query-gated detail page.
 *
 * Renders a sign-in prompt on 401 (an expired session is not the same as
 * missing data) and otherwise surfaces the server's own message so the buyer
 * knows whether to retry or give up.
 */
export function QueryErrorCard({
  error,
  what,
  backHref = "/",
  onRetry,
}: {
  error: unknown;
  what: string;
  backHref?: string;
  onRetry?: () => void;
}) {
  if (isUnauthorized(error)) {
    const next = typeof window !== "undefined" ? window.location.pathname : "";
    return (
      <Card className="space-y-3 p-8 text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
          <Lock className="size-5 text-neutral-500" />
        </span>
        <p className="text-lg font-bold">Sign in to view your {what}</p>
        <p className="text-sm text-neutral-500">Your session expired. Sign in again to pick up where you left off.</p>
        <Button asChild className="bg-ali-red text-white hover:bg-ali-red-dark">
          <Link href={`/sign-in?next=${encodeURIComponent(next)}`}>Sign in</Link>
        </Button>
      </Card>
    );
  }

  return (
    <Card className="space-y-3 p-8 text-center">
      <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/40">
        <TriangleAlert className="size-5 text-red-600" />
      </span>
      <p className="text-lg font-bold">Couldn&apos;t load this {what}</p>
      <p className="text-sm text-neutral-600" role="alert">{messageFor(error, "Please try again.")}</p>
      <div className="flex justify-center gap-2">
        {onRetry ? (
          <Button onClick={onRetry} className="bg-ali-red text-white hover:bg-ali-red-dark">
            <RefreshCw className="size-4" /> Try again
          </Button>
        ) : null}
        <Button variant="outline" asChild>
          <Link href={backHref}>Back</Link>
        </Button>
      </div>
    </Card>
  );
}
