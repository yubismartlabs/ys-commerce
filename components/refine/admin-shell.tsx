"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSelectedLayoutSegment } from "next/navigation";
import { useLogout, useGetIdentity } from "@refinedev/core";
import {
  ArrowLeft,
  Banknote,
  Bell,
  ChevronDown,
  Globe,
  KeyRound,
  LogOut,
  Mail,
  Menu,
  MessageSquareWarning,
  MessageCircle,
  Package,
  Settings,
  ShoppingCart,
  SlidersHorizontal,
  Store,
  Tag,
  Ticket,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { hasScope } from "@/lib/auth/permissions";
import { NotificationBell } from "@/components/notifications/notification-bell";

type Identity = { email?: string; name?: string | null; role?: string; scopes?: string[] };

type NavLink = { href: string; label: string; icon: React.ReactNode; scope: string };
type NavGroup = { key: string; label: string; icon: React.ReactNode; links: NavLink[] };

const NAV_GROUPS: NavGroup[] = [
  {
    key: "users",
    label: "Users",
    icon: <Users className="size-4" />,
    links: [
      { href: "/ys-admin/users", label: "Users", icon: <Users className="size-4" />, scope: "users" },
      { href: "/ys-admin/roles", label: "Roles", icon: <KeyRound className="size-4" />, scope: "users" },
    ],
  },
  {
    key: "sellers",
    label: "Sellers",
    icon: <Store className="size-4" />,
    links: [{ href: "/ys-admin/vendors", label: "Vendors", icon: <Store className="size-4" />, scope: "vendors" }],
  },
  {
    key: "catalog",
    label: "Catalog",
    icon: <Package className="size-4" />,
    links: [{ href: "/ys-admin/products", label: "Products", icon: <Package className="size-4" />, scope: "products" }],
  },
  {
    key: "orders",
    label: "Orders",
    icon: <ShoppingCart className="size-4" />,
    links: [
      { href: "/ys-admin/orders", label: "Orders", icon: <ShoppingCart className="size-4" />, scope: "orders" },
      { href: "/ys-admin/disputes", label: "Disputes", icon: <MessageSquareWarning className="size-4" />, scope: "disputes" },
      { href: "/ys-admin/chat", label: "Message reports", icon: <MessageCircle className="size-4" />, scope: "chat" },
    ],
  },
  {
    key: "marketing",
    label: "Marketing",
    icon: <Tag className="size-4" />,
    links: [
      { href: "/ys-admin/coupons", label: "Coupons", icon: <Ticket className="size-4" />, scope: "coupons" },
      { href: "/ys-admin/deals", label: "Flash deals", icon: <Zap className="size-4" />, scope: "deals" },
    ],
  },
  {
    key: "system",
    label: "System",
    icon: <Settings className="size-4" />,
    links: [
      { href: "/ys-admin/notifications", label: "Notifications", icon: <Bell className="size-4" />, scope: "any" },
      { href: "/ys-admin/payouts", label: "Payouts", icon: <Banknote className="size-4" />, scope: "payouts" },
      { href: "/ys-admin/emails", label: "Email log", icon: <Mail className="size-4" />, scope: "emails" },
      { href: "/ys-admin/settings/site", label: "Site settings", icon: <Globe className="size-4" />, scope: "settings" },
      { href: "/ys-admin/settings/system", label: "System settings", icon: <SlidersHorizontal className="size-4" />, scope: "settings" },
      { href: "/ys-admin/api-tokens", label: "API tokens", icon: <KeyRound className="size-4" />, scope: "admin" },
    ],
  },
];

/** Hide links (and emptied groups) the signed-in staff may not access. */
function visibleGroups(identity: Identity | undefined): NavGroup[] {
  if (!identity) return NAV_GROUPS;
  const scopes = identity.scopes ?? [];
  return NAV_GROUPS.map((g) => ({
    ...g,
    links: g.links.filter((l) => l.scope === "any" || hasScope(scopes, l.scope)),
  })).filter((g) => g.links.length > 0);
}

function findTitle(pathname: string): string {
  for (const g of NAV_GROUPS) {
    const hit = g.links.find((l) => pathname === l.href || pathname.startsWith(`${l.href}/`));
    if (hit) return hit.label;
  }
  return "ys-admin";
}

function SidebarNav({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname() ?? "";
  const [forced, setForced] = useState<Record<string, boolean>>({});

  return (
    <div className="grid gap-1">
      {groups.map((group) => {
        const isActive = group.links.some(
          (l) => pathname === l.href || pathname.startsWith(`${l.href}/`)
        );
        const open = forced[group.key] ?? isActive;

        return (
          <div key={group.key}>
            <Button
              variant="ghost"
              onClick={() => setForced((f) => ({ ...f, [group.key]: !(f[group.key] ?? isActive) }))}
              className="w-full justify-start gap-2.5 px-2 text-[11px] font-bold uppercase tracking-widest text-white/40 hover:bg-white/5 hover:text-white/70"
            >
              {group.icon}
              <span className="flex-1 text-left">{group.label}</span>
              <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
            </Button>
            {open ? (
              <div className="mt-0.5 grid gap-0.5">
                {group.links.map((link) => {
                  const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
                  return (
                    <Button
                      key={link.href}
                      variant="ghost"
                      asChild
                      onClick={onNavigate}
                      className={cn(
                        "relative justify-start gap-2.5 pl-9 text-white/70 hover:bg-white/5 hover:text-white",
                        active && "bg-white/10 font-semibold text-white hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <Link href={link.href}>
                        {active ? (
                          <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-ali-red" />
                        ) : null}
                        {link.icon}
                        {link.label}
                      </Link>
                    </Button>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const segment = useSelectedLayoutSegment();
  const { mutate: logout } = useLogout();
  const { data: identity } = useGetIdentity<Identity>();
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);

  // Auth page renders bare — no sidebar/topbar chrome on the login screen.
  if (segment === "login") return <>{children}</>;

  const name = identity?.name || identity?.email || "Admin";
  const groups = visibleGroups(identity);

  return (
    <div className="flex min-h-screen bg-neutral-100 dark:bg-neutral-950">
      {/* desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col overflow-y-auto bg-neutral-950 p-4 text-white md:flex">
        <Link href="/ys-admin/vendors" className="mb-1 px-2 text-xl font-black tracking-tight">
          <span className="text-ali-red">ys</span>-admin
        </Link>
        <p className="mb-5 px-2 text-[11px] uppercase tracking-widest text-white/40">Marketplace console</p>
        <nav>
          <SidebarNav groups={groups} />
        </nav>
        <div className="mt-auto space-y-2 border-t border-white/10 pt-3">
          <Link href="/" className="flex items-center gap-1.5 px-2 text-xs text-white/50 hover:text-white">
            <ArrowLeft className="size-3.5" /> Back to marketplace
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* topbar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-white/90 px-4 py-2.5 backdrop-blur dark:bg-neutral-900/90">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 overflow-y-auto bg-neutral-950 text-white">
              <Link href="/ys-admin/vendors" onClick={() => setOpen(false)} className="mb-5 block text-xl font-black">
                <span className="text-ali-red">ys</span>-admin
              </Link>
              <nav>
                <SidebarNav groups={groups} onNavigate={() => setOpen(false)} />
              </nav>
            </SheetContent>
          </Sheet>

          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{findTitle(pathname)}</p>
            <p className="hidden text-xs text-neutral-500 sm:block">Manage vendors, catalog, orders and disputes</p>
          </div>

          <div className="ml-auto flex items-center gap-1">
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 rounded-full pl-1.5 pr-2.5">
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-ali-red text-xs font-bold text-white">
                      {initials(name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-40 truncate text-sm font-medium sm:block">{name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{identity?.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/">Back to marketplace</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => logout()} className="text-red-600">
                  <LogOut className="size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
