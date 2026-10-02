"use client";

import { useQuery } from "@tanstack/react-query";
import { readEnvelope } from "@/lib/api/client";

/**
 * The buyer's saved sizes and brands, for storefront surfaces that want to
 * tailor themselves (variant badges, brand highlights).
 *
 * Deliberately forgiving: an unauthenticated visitor gets an empty result and
 * no error, and a failed request must never surface on a product page. A
 * missing preference is a cosmetic detail, not something worth an alert.
 */
export function useShoppingPreferences() {
  const query = useQuery({
    queryKey: ["shopping-preferences"],
    queryFn: async () => {
      const envelope = await readEnvelope<{ sizes: string[]; brands: string[] }>(
        await fetch("/api/v1/account/shopping-preferences")
      );
      return {
        sizes: envelope.data?.sizes ?? [],
        brands: envelope.data?.brands ?? [],
      };
    },
    retry: false,
    staleTime: 5 * 60_000,
  });
  return { sizes: query.data?.sizes ?? [], brands: query.data?.brands ?? [] };
}