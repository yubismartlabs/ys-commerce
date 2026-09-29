"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Bell,
  Camera,
  ChevronDown,
  CircleHelp,
  Globe,
  Heart,
  MapPin,
  Menu,
  Search,
  ShoppingCart,
  Store,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useCart } from "@/lib/store/cart";
import { useSession } from "@/lib/store/session";
import { useRouter } from "next/navigation";

const categories = [
  "All Categories",
  "Electronics",
  "Fashion",
  "Home & Garden",
  "Beauty",
  "Sports",
  "Toys & Kids",
  "Automotive",
  "Phones",
];

export function MarketplaceHeader() {
  const count = useCart((s) => s.count());
  const isSeller = useSession((s) => s.isSeller);
  const [q, setQ] = useState("");
  const router = useRouter();

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  };

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
            <Link href="/account" className="inline-flex items-center gap-1 hover:text-ali-red">
              <CircleHelp className="size-3.5" /> Help Center
            </Link>
            <Link href="/account" className="hover:text-ali-red">
              Buyer Protection
            </Link>
          </div>
        </div>
      </div>

      {/* main header */}
      <div className="border-b">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72">
              <p className="mb-3 text-lg font-extrabold text-ali-red">ys-commerce</p>
              <div className="grid gap-1">
                {categories.map((c) => (
                  <Link key={c} href="/search" className="rounded px-2 py-2 text-sm hover:bg-neutral-100">
                    {c}
                  </Link>
                ))}
              </div>
            </SheetContent>
          </Sheet>

          <Link href="/" className="shrink-0 text-2xl font-black tracking-tight">
            <span className="text-ali-red">ys</span>
            <span className="text-neutral-900">-commerce</span>
          </Link>

          <form onSubmit={submit} className="hidden flex-1 items-center md:flex">
            <div className="flex w-full overflow-hidden rounded-full border-2 border-ali-red">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="wireless earbuds, summer dress, led lights..."
                className="h-10 flex-1 rounded-none border-0 px-4 shadow-none focus-visible:ring-0"
              />
              <Button type="button" variant="ghost" size="icon" className="rounded-none" aria-label="Image search">
                <Camera className="size-5 text-neutral-500" />
              </Button>
              <Button type="submit" className="h-10 rounded-none bg-ali-red px-6 text-white hover:bg-ali-red-dark">
                <Search className="size-4" /> Search
              </Button>
            </div>
          </form>

          <div className="ml-auto flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="hidden gap-1 text-[13px] sm:inline-flex">
                  <User className="size-5" /> Hi, Buyer <ChevronDown className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My YS</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link href="/account">My Orders</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/watchlist">Watchlist</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/account">Coupons & Coins</Link></DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={isSeller ? "/selling/dashboard" : "/selling/onboarding"}>
                    {isSeller ? "Selling Dashboard" : "Start Selling"}
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="ghost" size="icon" asChild className="relative">
              <Link href="/watchlist" aria-label="Watchlist">
                <Heart />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
              <Bell />
              <Badge className="absolute -right-0.5 -top-0.5 size-4 justify-center bg-ali-red p-0 text-[10px] text-white">3</Badge>
            </Button>
            <Button variant="ghost" size="icon" asChild className="relative" aria-label="Cart">
              <Link href="/cart">
                <ShoppingCart />
                {count > 0 && (
                  <Badge className="absolute -right-0.5 -top-0.5 size-4 justify-center bg-ali-red p-0 text-[10px] text-white">
                    {count}
                  </Badge>
                )}
              </Link>
            </Button>
          </div>
        </div>

        {/* mobile search */}
        <div className="px-4 pb-3 md:hidden">
          <form onSubmit={submit} className="flex overflow-hidden rounded-full border-2 border-ali-red">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search on ys-commerce"
              className="h-9 flex-1 border-0 shadow-none focus-visible:ring-0"
            />
            <Button type="submit" size="icon" className="rounded-none bg-ali-red text-white">
              <Search className="size-4" />
            </Button>
          </form>
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
              {categories.slice(1).map((c) => (
                <DropdownMenuItem key={c} asChild>
                  <Link href={`/search?category=${c}`}>{c}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Link href="/search" className="whitespace-nowrap hover:text-ali-red">Flash Deals</Link>
          <Link href="/search" className="whitespace-nowrap hover:text-ali-red">Choice</Link>
          <Link href="/search" className="whitespace-nowrap hover:text-ali-red">SuperDeals</Link>
          <Link href="/selling/onboarding" className="whitespace-nowrap hover:text-ali-red">Sell on YS</Link>
        </div>
      </nav>
    </header>
  );
}
