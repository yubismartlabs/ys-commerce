"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSelectedLayoutSegment } from "next/navigation";
import { useLogout, useMenu, useGetIdentity } from "@refinedev/core";
import { ArrowLeft, LogOut, Menu, Settings } from "lucide-react";
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

type Identity = { email?: string; name?: string | null };

function NavItems({ selectedKey, onNavigate }: { selectedKey: string; onNavigate?: () => void }) {
  const { menuItems } = useMenu();
  const pathname = usePathname();
  const settingsActive = pathname?.startsWith("/ys-admin/settings") ?? false;
  return (
    <>
      {menuItems.map((item) => {
        const active = item.key === selectedKey;
        return (
          <Button
            key={item.key}
            variant="ghost"
            asChild
            onClick={onNavigate}
            className={cn(
              "relative justify-start gap-2.5 text-white/70 hover:bg-white/5 hover:text-white",
              active && "bg-white/10 font-semibold text-white hover:bg-white/10 hover:text-white"
            )}
          >
            <Link href={item.route ?? "#"}>
              {active ? <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-ali-red" /> : null}
              {item.icon}
              {item.label}
            </Link>
          </Button>
        );
      })}
      <Button
        variant="ghost"
        asChild
        onClick={onNavigate}
        className={cn(
          "relative justify-start gap-2.5 text-white/70 hover:bg-white/5 hover:text-white",
          settingsActive && "bg-white/10 font-semibold text-white hover:bg-white/10 hover:text-white"
        )}
      >
        <Link href="/ys-admin/settings">
          {settingsActive ? <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-ali-red" /> : null}
          <Settings className="size-4" />
          Settings
        </Link>
      </Button>
    </>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const segment = useSelectedLayoutSegment();
  const { selectedKey, menuItems } = useMenu();
  const { mutate: logout } = useLogout();
  const { data: identity } = useGetIdentity<Identity>();
  const [open, setOpen] = useState(false);

  // Auth page renders bare — no sidebar/topbar chrome on the login screen.
  if (segment === "login") return <>{children}</>;

  const name = identity?.name || identity?.email || "Admin";
  const current = menuItems.find((i) => i.key === selectedKey);

  return (
    <div className="flex min-h-screen bg-neutral-100 dark:bg-neutral-950">
      {/* desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col bg-neutral-950 p-4 text-white md:flex">
        <Link href="/ys-admin/vendors" className="mb-1 px-2 text-xl font-black tracking-tight">
          <span className="text-ali-red">ys</span>-admin
        </Link>
        <p className="mb-5 px-2 text-[11px] uppercase tracking-widest text-white/40">Marketplace console</p>
        <nav className="grid gap-1">
          <NavItems selectedKey={selectedKey} />
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
            <SheetContent side="left" className="w-72 bg-neutral-950 text-white">
              <Link href="/ys-admin/vendors" onClick={() => setOpen(false)} className="mb-5 block text-xl font-black">
                <span className="text-ali-red">ys</span>-admin
              </Link>
              <nav className="grid gap-1">
                <NavItems selectedKey={selectedKey} onNavigate={() => setOpen(false)} />
              </nav>
            </SheetContent>
          </Sheet>

          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{current?.label ?? "ys-admin"}</p>
            <p className="hidden text-xs text-neutral-500 sm:block">Manage vendors, catalog, orders and disputes</p>
          </div>

          <div className="ml-auto">
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
