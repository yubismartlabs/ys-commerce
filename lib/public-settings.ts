"use client";

import { useQuery } from "@tanstack/react-query";

type PublicSettings = {
  siteName: string;
  logoUrl: string;
  announcement: string;
  maintenance: { enabled: boolean; message: string };
};

const FALLBACK: PublicSettings = {
  siteName: "ys-commerce",
  logoUrl: "",
  announcement: "",
  maintenance: { enabled: false, message: "" },
};

async function fetchPublicSettings(): Promise<PublicSettings> {
  const res = await fetch("/api/v1/settings/public");
  if (!res.ok) throw new Error("settings unavailable");
  const json = await res.json();
  return { ...FALLBACK, ...(json.data ?? {}) };
}

/** Live site brand for the storefront. Falls back to built-ins when offline. */
export function usePublicSettings(): PublicSettings {
  const query = useQuery({
    queryKey: ["public-settings"],
    queryFn: fetchPublicSettings,
    staleTime: 60_000,
    retry: 1,
  });
  return query.data ?? FALLBACK;
}
