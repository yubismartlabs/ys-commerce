/** Site-wide account section slug (admin-configurable, defaults to "account"). */
export const DEFAULT_ACCOUNT_SLUG = "account";

/** Pure helper: prefix an account-section path with the configured slug. */
export function accountPath(path: string, slug: string = DEFAULT_ACCOUNT_SLUG): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `/${slug}${clean}`;
}
