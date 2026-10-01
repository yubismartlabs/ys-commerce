"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  isItemActive,
  type AccountSection,
  type NavGroup,
  type NavItem,
} from "@/lib/account-section";

function NavItem({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  // Not built yet: shown so the information architecture reads as a whole,
  // but not a link — a dead href would 404.
  if (item.soon) {
    return (
      <span
        aria-disabled="true"
        className="flex cursor-default items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-neutral-400 dark:text-neutral-600"
      >
        <Icon className="size-4 shrink-0" />
        {item.label}
        <Badge variant="secondary" className="ml-auto text-[10px]">
          Soon
        </Badge>
      </span>
    );
  }
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition",
        active
          ? "bg-neutral-900 font-semibold text-white dark:bg-white dark:text-neutral-900"
          : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
      )}
    >
      <Icon className="size-4 shrink-0" />
      {item.label}
    </Link>
  );
}

function Section({ title, items, pathname, view }: { title: string | null; items: NavItem[]; pathname: string; view: string | null }) {
  return (
    <div>
      {title ? (
        <p className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
          {title}
        </p>
      ) : null}
      <div className="grid gap-0.5">
        {items.map((item) => (
          <NavItem key={item.href} item={item} active={isItemActive(item, pathname, view)} />
        ))}
      </div>
    </div>
  );
}

/**
 * Section sidebar for My YS. Receives the groups for the active section —
 * Messages has no sidebar at all, so this is only rendered for the two
 * sections that have one (see `hasSidebar`).
 */
export function AccountSidebar({ groups, section }: { groups: NavGroup[]; section: AccountSection }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const view = search.get("view");

  return (
    <nav aria-label={section === "account" ? "Account settings" : "Account activity"} className="grid gap-5">
      {groups.map((group) => (
        <Section key={group.title ?? "main"} title={group.title} items={group.items} pathname={pathname} view={view} />
      ))}
    </nav>
  );
}