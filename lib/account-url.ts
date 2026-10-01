"use client";

import { useParams } from "next/navigation";
import { usePublicSettings } from "@/lib/public-settings";
import { accountPath, DEFAULT_ACCOUNT_SLUG } from "@/lib/account-path";

export { accountPath, DEFAULT_ACCOUNT_SLUG };

/** Hook for client components: (path) => "/<slug>/path". Slug from live settings. */
export function useAccountUrl(): (path: string) => string {
  const { accountSlug } = usePublicSettings();
  const slug = accountSlug || DEFAULT_ACCOUNT_SLUG;
  return (path: string) => accountPath(path, slug);
}

/**
 * Base prefix ("/<slug>") for pages already inside the account section.
 * The layout 404s on a wrong slug, so the URL slug is always the configured
 * one — no settings fetch needed.
 */
export function useAccountBase(): string {
  const params = useParams();
  const raw = params.accountSlug;
  const slug = typeof raw === "string" && raw ? raw : DEFAULT_ACCOUNT_SLUG;
  return `/${slug}`;
}
