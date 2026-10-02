"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useCollapsedGroups } from "@/lib/hooks/use-collapsed-groups";
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

/**
 * A titled group. Collapsible ones get a toggle; the buyer's choice is kept in
 * localStorage so folding Selling away survives navigation — otherwise it
 * would spring open again on every page change and the toggle would be a
 * gesture that goes nowhere.
 *
 * A group holding the CURRENT page is force-shown even when recorded as
 * collapsed: a buyer who collapsed Selling, then clicked a link into it from
 * elsewhere, would otherwise land on a page with no nav entry highlighted.
 */
function Section({
  title,
  icon: GroupIcon,
  items,
  collapsible,
  collapsed,
  onToggle,
  pathname,
  view,
}: {
  title: string | null;
  icon?: React.ElementType;
  items: NavItem[];
  collapsible: boolean;
  collapsed: boolean;
  onToggle: () => void;
  pathname: string;
  view: string | null;
}) {
  const anyActive = items.some((i) => isItemActive(i, pathname, view));
  const show = !collapsible || !collapsed || anyActive;

  return (
    <div>
      {title ? (
        collapsible ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={show}
            className="group/head flex w-full items-center gap-1.5 rounded px-3 pb-1.5 text-left text-[11px] font-bold uppercase tracking-wider text-neutral-400 transition hover:text-neutral-700 dark:hover:text-neutral-200"
          >
            {GroupIcon ? <GroupIcon className="size-3.5 shrink-0" aria-hidden /> : null}
            {title}
            <ChevronDown
              className={cn(
                "ml-auto size-3.5 transition-transform",
                show ? "rotate-0" : "-rotate-90"
              )}
            />
          </button>
        ) : (
          <p className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
            {title}
          </p>
        )
      ) : null}
      {show ? (
        <div className="grid gap-0.5">
          {items.map((item) => (
            <NavItem key={item.href} item={item} active={isItemActive(item, pathname, view)} />
          ))}
        </div>
      ) : null}
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
  const [collapsed, toggle] = useCollapsedGroups();

  return (
    <nav aria-label={section === "account" ? "Account settings" : "Account activity"} className="grid gap-5">
      {groups.map((group) => (
        <Section
          key={group.title ?? "main"}
          title={group.title}
          icon={group.icon}
          items={group.items}
          collapsible={!!group.collapsible}
          collapsed={!!collapsed[group.title ?? ""]}
          onToggle={() => group.title && toggle(group.title)}
          pathname={pathname}
          view={view}
        />
      ))}
    </nav>
  );
}