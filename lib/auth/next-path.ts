/**
 * Validate a post-auth redirect target.
 *
 * `/sign-in?next=` is user-controlled and fed straight to `router.push` /
 * `router.replace`, so an absolute or protocol-relative value turns the login
 * page into an open redirect (`?next=https://evil.com`). Only same-origin
 * relative paths are allowed.
 */
export function safeNextPath(raw: string | null | undefined, fallback = "/"): string {
  if (!raw) return fallback;
  const value = raw.trim();
  if (!value) return fallback;
  // Reject absolute URLs, protocol-relative URLs, and backslash tricks that
  // some browsers normalize to "//host".
  if (value.startsWith("//") || value.startsWith("\\") || /^[a-z][a-z0-9+.-]*:/i.test(value)) {
    return fallback;
  }
  // Must be a rooted, single-slash path. Rejects "/\evil.com" style bypasses.
  if (!value.startsWith("/") || value.startsWith("/\\")) return fallback;
  return value;
}
