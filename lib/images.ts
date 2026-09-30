/**
 * Central image-host policy.
 *
 * `next/image` THROWS during render when a `src` points at a host that is not
 * in `images.remotePatterns`. Sellers paste arbitrary URLs, so an unvalidated
 * host could take down every page that renders a product image.
 *
 * Defence in depth, three layers:
 *   1. `next.config.ts` builds `remotePatterns` from `allowedImageHosts()`.
 *   2. `assertAllowedImageUrl()` rejects bad hosts at SAVE time (see
 *      `imageUrlSchema`), so new bad rows never get written.
 *   3. `safeImageSrc()` sanitises at READ time, so legacy rows that predate
 *      validation still render a placeholder instead of crashing the page.
 *
 * Local paths (`/uploads/...`) are always allowed — they never hit the
 * optimizer's remote loader.
 */

/** Placeholder served for any image we refuse to load. */
export const IMAGE_FALLBACK = "/placeholder-product.svg";

/** Seeded/demo host so a fresh `npm run db:seed` renders out of the box. */
const BUILTIN_HOSTS = ["picsum.photos"];

/**
 * Extra hosts from `IMAGE_HOSTS` (comma-separated). Set this to the hostname
 * of your object store / CDN, e.g. `IMAGE_HOSTS=my-bucket.r2.cloudflarestorage.com`.
 */
function envHosts(): string[] {
  return (process.env.IMAGE_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

export function allowedImageHosts(): string[] {
  return [...new Set([...BUILTIN_HOSTS, ...envHosts()])];
}

/** True when the URL is same-origin (a local `/path`) or on an allowed host. */
export function isAllowedImageUrl(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const url = raw.trim();
  if (!url) return false;
  // Local uploads and any root-relative path bypass the remote optimizer.
  if (url.startsWith("/") && !url.startsWith("//")) return true;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  return allowedImageHosts().includes(parsed.hostname.toLowerCase());
}

/**
 * Return the URL if it is safe to hand to `next/image`, otherwise the local
 * placeholder. Apply this wherever a seller-supplied image is serialized to
 * the client — it makes an unconfigured host impossible to render.
 */
export function safeImageSrc(raw: string | null | undefined): string {
  if (!raw || !raw.trim()) return IMAGE_FALLBACK;
  return isAllowedImageUrl(raw) ? raw.trim() : IMAGE_FALLBACK;
}

/** Map a list of image URLs, dropping any that are unusable. */
export function safeImageList(raw: Array<string | null | undefined> | null | undefined): string[] {
  if (!raw) return [];
  return raw.filter((u): u is string => isAllowedImageUrl(u));
}

/** Message used by seller-facing validation. */
export function describeImagePolicy(): string {
  return `Image must be an https URL on one of: ${allowedImageHosts().join(", ")} — or upload a file.`;
}
