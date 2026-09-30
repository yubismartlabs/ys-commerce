"use client";

import Link from "next/link";
import {
  ChevronDown,
  CircleHelp,
  Globe,
  Heart,
  MapPin,
  Menu,
  ShoppingCart,
  Sparkles,
  Store,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useCart } from "@/lib/store/cart";
import { CATEGORIES, categoryHref } from "@/lib/categories";
import { usePublicSettings } from "@/lib/public-settings";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { BuyerBell } from "@/components/notifications/buyer-bell";
import { SearchBox } from "@/components/search/search-box";
import { AssistantHeaderButton } from "@/components/ai/assistant-shell";
import { useAssistant } from "@/lib/store/assistant";
import { signOut, useSession } from "next-auth/react";

export function MarketplaceHeader() {
  const hydrated = useHydrated();
  const count = useCart((s) => s.count());
  // Zustand `persist` rehydrates from localStorage only on the client, so the
  // server always renders count = 0. Render the badge only after hydration to
  // keep server HTML and the first client render identical.
  const displayCount = hydrated ? count : 0;
  const { data: session, status } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const isSeller = role === "SELLER" || role === "ADMIN";
  const firstName = session?.user?.name?.split(" ")[0] ?? "Buyer";
  const { siteName, logoUrl, aiEnabled, aiName } = usePublicSettings();
  const assistantOpen = useAssistant((s) => s.open);
  const openAssistant = useAssistant((s) => s.openWith);

  return (
    <header className="sticky top-0 z-40 bg-white">
      {/* utility bar */}
      <div className="hidden bg-neutral-100 text-[12px] text-neutral-600 md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-1.5">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" /> Ship to <strong className="font-semibold">US</strong>
            </span>
            <span className="inline-flex items-center gap-1">
              <Globe className="size-3.5" /> EN / USD
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/selling/onboarding" className="inline-flex items-center gap-1 hover:text-ali-red">
              <Store className="size-3.5" /> Sell on YS
            </Link>
            <Link href="/account?tab=orders" className="inline-flex items-center gap-1 hover:text-ali-red">
              <CircleHelp className="size-3.5" /> Track order
            </Link>
          </div>
        </div>
      </div>

      {/* main header */}
      <div className="border-b">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72">
              <p className="mb-3 text-lg font-extrabold text-ali-red">ys-commerce</p>
              <div className="grid gap-1">
                {aiEnabled ? (
                  <SheetClose asChild>
                    <button
                      onClick={() => openAssistant()}
                      aria-expanded={assistantOpen}
                      className="flex items-center gap-2 rounded px-2 py-2 text-left text-sm font-semibold text-ali-red hover:bg-neutral-100"
                    >
                      <Sparkles className="size-4" /> {aiName}
                    </button>
                  </SheetClose>
                ) : null}
                <Link href="/search" className="rounded px-2 py-2 text-sm font-semibold hover:bg-neutral-100">
                  All Categories
                </Link>
                {CATEGORIES.map((c) => (
                  <Link
                    key={c.slug}
                    href={categoryHref(c.slug)}
                    className="rounded px-2 py-2 text-sm hover:bg-neutral-100"
                  >
                    {c.label}
                  </Link>
                ))}
              </div>
            </SheetContent>
          </Sheet>

          <Link href="/" className="flex shrink-0 items-center gap-2" aria-label={siteName}>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={siteName} className="h-8 max-w-36 object-contain" />
            ) : (
              <span className="text-2xl font-black tracking-tight">
                <span className="text-ali-red">{siteName.slice(0, 2)}</span>
                <span className="text-neutral-900">{siteName.slice(2)}</span>
              </span>
            )}
          </Link>

          <SearchBox className="hidden md:block" />

          <div className="ml-auto flex items-center gap-1">
            {status === "unauthenticated" ? (
              <Button variant="ghost" className="hidden gap-1 text-[13px] sm:inline-flex" asChild>
                <Link href="/sign-in">
                  <User className="size-5" /> Sign in
                </Link>
              </Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="hidden max-w-44 gap-1 text-[13px] sm:inline-flex">
                    <User className="size-5 shrink-0" />
                    <span className="truncate">Hi, {status === "loading" ? "…" : firstName}</span>
                    <ChevronDown className="size-3.5 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="truncate">{session?.user?.email ?? "My YS"}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild><Link href="/account">My Orders</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link href="/account/messages">Messages</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link href="/watchlist">Watchlist</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link href="/account?tab=coupons">My coupons</Link></DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={isSeller ? "/selling/dashboard" : "/selling/onboarding"}>
                      {isSeller ? "Selling Dashboard" : "Start Selling"}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })}>
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <Button variant="ghost" size="icon" asChild className="relative">
              <Link href="/watchlist" aria-label="Watchlist">
                <Heart />
              </Link>
            </Button>
            <BuyerBell />
            {aiEnabled ? <AssistantHeaderButton /> : null}
            <Button variant="ghost" size="icon" asChild className="relative" aria-label="Cart">
              <Link href="/cart">
                <ShoppingCart />
                {displayCount > 0 && (
                  <Badge
                    className="absolute -right-0.5 -top-0.5 size-4 justify-center bg-ali-red p-0 text-[10px] text-white"
                    // The toast announces "Added to cart"; without this a screen
                    // reader has no way to learn the cart is no longer empty.
                    aria-live="polite"
                    aria-label={`${displayCount} item${displayCount === 1 ? "" : "s"} in cart`}
                  >
                    {displayCount}
                  </Badge>
                )}
              </Link>
            </Button>
          </div>
        </div>

        {/* mobile search */}
        <div className="px-4 pb-3 md:hidden">
          <SearchBox />
        </div>
      </div>

      {/* category nav */}
      <nav className="hidden border-b bg-white md:block">
        <div className="no-scrollbar mx-auto flex max-w-7xl items-center gap-6 overflow-x-auto px-4 py-2 text-[13px] font-medium text-neutral-700">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1 font-semibold">
                <Menu className="size-4" /> All Categories <ChevronDown className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              {CATEGORIES.map((c) => (
                <DropdownMenuItem key={c.slug} asChild>
                  <Link href={categoryHref(c.slug)}>{c.label}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Link href="/deals" className="whitespace-nowrap hover:text-ali-red">Flash Deals</Link>
          <Link href="/search?badge=Choice&sort=rating" className="whitespace-nowrap hover:text-ali-red">Choice</Link>
          <Link href="/search?deals=1" className="whitespace-nowrap hover:text-ali-red">SuperDeals</Link>
          {aiEnabled ? (
            <button
              onClick={() => openAssistant()}
              aria-expanded={assistantOpen}
              className="inline-flex items-center gap-1 whitespace-nowrap font-semibold text-ali-red hover:text-ali-red-dark"
            >
              <Sparkles className="size-3.5" /> {aiName}
            </button>
          ) : null}
          <Link href="/selling/onboarding" className="whitespace-nowrap hover:text-ali-red">Sell on YS</Link>
        </div>
      </nav>
    </header>
  );
}
