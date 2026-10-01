"use client";

import { useQuery } from "@tanstack/react-query";

/**
 * Whether the signed-in user owns at least one store. Anyone can open a
 * store and list — "seller" is derived from ownership, never from a role.
 * Unauthenticated / storeless users get `false` (never an error throw).
 */
export function useHasStore(): boolean {
  const query = useQuery({
    queryKey: ["my-stores"],
    queryFn: async (): Promise<boolean> => {
      const res = await fetch("/api/v1/account/selling/store");
      if (!res.ok) return false;
      const json = await res.json().catch(() => null);
      const data = json?.data;
      return Array.isArray(data) ? data.length > 0 : !!data;
    },
    staleTime: 60_000,
    retry: false,
  });
  return query.data ?? false;
}
