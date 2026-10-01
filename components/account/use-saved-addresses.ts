"use client";

import { useQuery } from "@tanstack/react-query";
import { readEnvelope } from "@/lib/api/client";

export type SavedAddress = {
  id: string;
  label: string | null;
  name: string;
  phone: string | null;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string;
  country: string;
  isDefault: boolean;
};

/**
 * The buyer's address book, for checkout.
 *
 * Signed out (or a request that fails for any reason) is not an error here —
 * checkout simply falls back to the inline form, which is the only thing that
 * ever worked before the address book existed. So this never surfaces an error
 * state to the buyer.
 */
export function useSavedAddresses() {
  const query = useQuery({
    queryKey: ["checkout-addresses"],
    queryFn: async () => {
      const envelope = await readEnvelope<SavedAddress[]>(await fetch("/api/v1/account/addresses"));
      return envelope.data ?? [];
    },
    retry: false,
  });
  return { rows: query.data ?? [], isLoading: query.isLoading };
}