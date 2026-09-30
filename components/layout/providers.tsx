"use client";

import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";

/**
 * Shared query defaults. Without these, TanStack defaults to staleTime 0 +
 * refetch-on-every-focus + 3 blind retries, which on a storefront means each
 * tab switch refires every mounted query and every 401/403/404 costs three
 * extra round-trips before finally surfacing the error.
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data stays fresh long enough that nav + tab switching doesn't refetch.
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        // Never retry a client error: 401 means "sign in", 403/404/422 will
        // fail identically forever. Only transient server/network faults retry.
        retry: (failureCount, error) => {
          if (error && typeof error === "object" && "status" in error) {
            const status = (error as { status?: number }).status;
            if (typeof status === "number" && status >= 400 && status < 500) return false;
          }
          return failureCount < 2;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(makeQueryClient);
  return (
    <SessionProvider>
      <QueryClientProvider client={client}>
        {children}
        <Toaster richColors position="top-center" />
      </QueryClientProvider>
    </SessionProvider>
  );
}
