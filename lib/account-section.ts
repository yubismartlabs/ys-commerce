import {
  Bell,
  CalendarClock,
  CreditCard,
  Globe,
  Heart,
  HeartHandshake,
  History,
  Languages,
  LayoutDashboard,
  Lock,
  MapPin,
  MessageSquareText,
  Package,
  PackageCheck,
  PackageX,
  Plus,
  Receipt,
  SlidersHorizontal,
  Star,
  Store,
  User,
  Wallet,
} from "lucide-react";

/**
 * My YS information architecture: three top-level sections (Activity,
 * Messages, Account), each rendering its own sidebar. The tabs are derived
 * from the URL rather than owning it — the canonical address of a page is
 * unchanged (/account/orders, /account/messages, /account/settings), so
 * existing links, notifications and deep links keep resolving.
 */
export type AccountSection = "activity" | "messages" | "account";

export type NavItem = {
  /** Absolute account-section href, e.g. "/orders?view=selling". */
  href: string;
  label: string;
  icon: React.ElementType;
  /**
   * Extra path prefixes that light this item up. Without it a detail page
   * (/orders/YS-1) highlights nothing.
   */
  match?: string[];
/**
   * Value of the ?view= param that makes this item the active one. Two items
   * can share a path (Purchases / Sales both live on /orders) and are told
   * apart by this. Items without it ignore the param.
   */
  view?: string;
  /**
   * The view a path falls back to when ?view is absent — "buying" for
   * /orders, "all" for /listings. Without it an item could never be active on
   * its own undecorated path, and the default would have to be hardcoded here
   * for whichever page happened to come first.
   */
  defaultView?: string;
  /** Not built yet — rendered disabled with a "Soon" badge, never a link. */
  soon?: boolean;
  /**
   * href lives outside the account section (e.g. /watchlist, which is shared
   * with the storefront header) and must not be slug-prefixed.
   */
  external?: boolean;
};

export type NavGroup = {
  title: string | null;
  items: NavItem[];
  /** Shown beside the group title, as an anchor when the group is collapsed. */
  icon?: React.ElementType;
  /**
   * Render a toggle so the buyer can fold this group away. Selling is the
   * reason this exists: six entries most buyers never open, sitting below a
   * six-item buying list. A group with no title is the primary list and is
   * never collapsible — there would be nothing left if it were.
   */
  collapsible?: boolean;
};

/**
 * Which section a pathname belongs to. Messages is matched first because it
 * is the only section with no sidebar; everything not named explicitly falls
 * through to Activity, which owns the majority of the account routes.
 */
const MESSAGES_PREFIXES = ["/messages"];
const ACCOUNT_PREFIXES = ["/settings", "/notifications"];

function matches(pathname: string, base: string, prefix: string): boolean {
  if (pathname !== base && !pathname.startsWith(`${base}/`)) return false;
  const path = pathname === base ? "/" : pathname.slice(base.length);
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function resolveSection(pathname: string, base: string): AccountSection {
  if (MESSAGES_PREFIXES.some((p) => matches(pathname, base, p))) return "messages";
  if (ACCOUNT_PREFIXES.some((p) => matches(pathname, base, p))) return "account";
  return "activity";
}

/**
 * Two items can share one path (Purchases and Sales both live on /orders,
 * told apart by ?view). Detail routes are a different case: /sales/YS-1 and
 * /orders/YS-1 are separate paths that light up their own item via match,
 * with no view param to compare.
 */
export function isItemActive(item: NavItem, pathname: string, view: string | null): boolean {
  if (pathname !== item.href.split("?")[0]) {
    return (item.match ?? []).some((m) => pathname.startsWith(m));
  }
  if (item.view === undefined) return true;
  return (view ?? item.defaultView ?? "") === item.view;
}

export const ACCOUNT_TABS: { key: AccountSection; label: string; path: string }[] = [
  { key: "activity", label: "Activity", path: "/summary" },
  { key: "messages", label: "Messages", path: "/messages" },
  { key: "account", label: "Account", path: "/settings" },
];

/**
 * Activity owns buying and selling. Watchlist is deliberately top-level
 * (/watchlist) rather than under the account slug — it is shared with the
 * storefront header.
 *
 * The selling entries are all views over one listings table rather than
 * separate pages, the same way Purchases and Sales are two views of /orders:
 * Overview is every listing, and the other three narrow it. That keeps the
 * count in each row honest without four near-identical screens.
 */
export function activityGroups(): NavGroup[] {
  return [
    {
      title: null,
      items: [
        { href: "/summary", label: "Summary", icon: LayoutDashboard },
        { href: "/recently-viewed", label: "Recently viewed", icon: History },
        { href: "/watchlist", label: "Watchlist", icon: Heart, external: true },
        { href: "/orders", label: "Purchases", icon: Package, match: ["/orders/"], view: "buying", defaultView: "buying" },
        { href: "/following", label: "Following", icon: HeartHandshake },
        { href: "/reviews", label: "My reviews", icon: Star, match: ["/reviews/"] },
        { href: "/preferences", label: "Shopping preferences", icon: SlidersHorizontal },
      ],
    },
    {
      title: "Selling",
      icon: Store,
      collapsible: true,
      items: [
        { href: "/listings", label: "Overview", icon: LayoutDashboard, match: ["/listings/"], view: "all", defaultView: "all" },
        { href: "/listings/new", label: "Sell an item", icon: Plus, match: ["/listings/bulk"] },
        { href: "/listings?view=scheduled", label: "Scheduled", icon: CalendarClock, view: "scheduled" },
        { href: "/listings?view=sold", label: "Sold", icon: PackageCheck, view: "sold" },
        { href: "/listings?view=unsold", label: "Unsold", icon: PackageX, view: "unsold" },
        { href: "/payouts", label: "Payment", icon: Wallet },
      ],
    },
  ];
}

/**
 * Account is settings-shaped: who you are, how you pay, how the site behaves.
 * Every entry that isn't wired to an existing page is marked soon. Removing a
 * `soon` flag is the only edit needed to ship one of them — see
 * `isItemActive` for why a sub-route also needs `match`.
 */
export const ACCOUNT_GROUPS: NavGroup[] = [
  {
    title: "Personal info",
    items: [
      { href: "/settings", label: "User information", icon: User },
      { href: "/settings/security", label: "Sign in & security", icon: Lock, soon: true },
      { href: "/settings/addresses", label: "Addresses", icon: MapPin, match: ["/settings/addresses/"] },
      { href: "/settings/feedback", label: "Feedback", icon: MessageSquareText, soon: true },
    ],
  },
  {
    title: "Payment",
    items: [
      { href: "/settings/payment-methods", label: "Payment methods", icon: CreditCard, soon: true },
      { href: "/settings/payment-history", label: "Transaction history", icon: Receipt, soon: true },
    ],
  },
  {
    title: "Preferences",
    items: [
      { href: "/notifications", label: "Notifications", icon: Bell },
      { href: "/settings/language", label: "Language & region", icon: Languages, soon: true },
      { href: "/settings/privacy", label: "Privacy", icon: Globe, soon: true },
    ],
  },
];

/** Prefix an account-section-relative path with the site-wide section slug. */
function withBase(path: string, base: string): string {
  return path.startsWith("/") ? `${base}${path}` : path;
}

export function groupsFor(section: AccountSection, base: string): NavGroup[] {
  const source = section === "activity" ? activityGroups() : section === "account" ? ACCOUNT_GROUPS : [];
  return source.map((group) => ({
    // Spread first: the slug rewrite below only rewrites what it knows about,
    // and anything it dropped (collapsible) would silently default to false.
    ...group,
    items: group.items.map((item) => ({
      ...item,
      href: item.external ? item.href : withBase(item.href, base),
      match: item.match?.map((m) => withBase(m, base)),
    })),
  }));
}

/** Messages is the one section with no sidebar of its own. */
export function hasSidebar(section: AccountSection): boolean {
  return section !== "messages";
}