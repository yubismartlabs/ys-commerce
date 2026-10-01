import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import {
  Package,
  Heart,
  HeartHandshake,
  MessageCircle,
  Ticket,
  ShieldAlert,
  RotateCcw,
  ChevronRight,
  Store,
} from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getSettingGroup } from "@/lib/server-settings";
import { accountPath } from "@/lib/account-path";
import { ensureUserUsername } from "@/lib/usernames-server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/refine/ui";
import { formatUSD, timeAgo } from "@/lib/format";

export const metadata = { title: "My YS — Summary" };

const TAB_TO_ROUTE: Record<string, string> = {
  orders: "/orders",
  disputes: "/disputes",
  returns: "/returns",
  reviews: "/reviews",
  coupons: "/coupons",
  settings: "/settings",
};

/**
 * My eBay-style summary: stat cards across buying + after-sales, then
 * recent orders, watchlist preview, and a selling shortcut.
 * Server-rendered from Prisma so first paint already has counts.
 */
export default async function AccountSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const site = await getSettingGroup("site");
  const base = (p: string) => accountPath(p, site.accountSlug);
  // Back-compat: old header/footer links used /account?tab=orders etc.
  const { tab } = await searchParams;
  if (tab && TAB_TO_ROUTE[tab]) redirect(base(TAB_TO_ROUTE[tab]));

  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect(`/sign-in?next=${encodeURIComponent(base("/summary"))}`);
  const username = (session?.user as { username?: string | null } | undefined)?.username ?? (await ensureUserUsername(userId));

  const [
    orderCount,
    activeOrders,
    recentOrders,
    watchlistCount,
    watchlistPreview,
    followingCount,
    openDisputes,
    openReturns,
    unreadNotifications,
    reviewCount,
    unreadMessages,
    storeCount,
    activeListings,
  ] = await Promise.all([
    db.order.count({ where: { buyerId: userId } }),
    db.order.count({ where: { buyerId: userId, status: { in: ["PENDING", "PAID", "SHIPPED"] } } }),
    db.order.findMany({
      where: { buyerId: userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { items: { take: 3 } },
    }),
    db.wishlistItem.count({ where: { userId } }),
    db.wishlistItem.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 4,
      include: { product: { select: { slug: true, title: true, image: true, price: true } } },
    }),
    db.storeFollow.count({ where: { userId } }),
    db.dispute.count({ where: { buyerId: userId, status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
    db.returnRequest.count({ where: { buyerId: userId, status: { in: ["REQUESTED", "ACCEPTED", "RECEIVED"] } } }),
    db.notification.count({ where: { userId, readAt: null } }).catch(() => 0),
    db.review.count({ where: { authorId: userId } }),
    db.chatMessage
      .count({
        where: {
          conversation: { OR: [{ buyerId: userId }, { sellerId: userId }] },
          NOT: { senderId: userId },
        },
      })
      .catch(() => 0),
    db.store.count({ where: { ownerId: userId } }),
    db.product.count({ where: { store: { ownerId: userId }, status: "ACTIVE" } }),
  ]);

  const stats = [
    { href: base("/orders"), label: "Active orders", value: activeOrders, sub: `${orderCount} total`, icon: Package },
    { href: "/watchlist", label: "Watchlist", value: watchlistCount, sub: "price-tracked items", icon: Heart },
    { href: base("/following"), label: "Following", value: followingCount, sub: "stores you follow", icon: HeartHandshake },
    { href: base("/messages"), label: "Unread messages", value: unreadMessages, sub: "buyer ↔ seller chats", icon: MessageCircle },
    { href: base("/coupons"), label: "Coupons", value: "View", sub: "redeemable codes", icon: Ticket },
    { href: base("/disputes"), label: "Open disputes", value: openDisputes, sub: "buyer protection", icon: ShieldAlert },
    { href: base("/returns"), label: "Open returns", value: openReturns, sub: "after-sales requests", icon: RotateCcw },
  ];

  return (
    <div className="space-y-4">
      {username ? (
        <p className="text-sm text-neutral-500">
          Signed in as{" "}
          <Link href={`/u/${username}`} className="font-mono font-semibold text-ali-red hover:underline">
            @{username}
          </Link>
        </p>
      ) : null}
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <Link key={s.href + s.label} href={s.href}>
            <Card className="group p-4 transition hover:shadow-md">
              <s.icon className="size-5 text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-white" />
              <p className="mt-2 text-2xl font-black tabular-nums">{s.value}</p>
              <p className="text-[13px] font-semibold">{s.label}</p>
              <p className="text-xs text-neutral-500">{s.sub}</p>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Recent orders */}
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold">Recent orders</h2>
            <Link href={base("/orders")} className="inline-flex items-center text-[13px] text-neutral-500 hover:text-neutral-900">
              Purchase history <ChevronRight className="size-4" />
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <div className="space-y-2 py-4 text-center text-sm text-neutral-500">
              <p>No orders yet.</p>
              <Button size="sm" variant="outline" asChild><Link href="/">Start shopping</Link></Button>
            </div>
          ) : (
            <ul className="divide-y">
              {recentOrders.map((o) => (
                <li key={o.id}>
                  <Link href={base(`/orders/${encodeURIComponent(o.number)}`)} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm font-bold">{o.number}</p>
                      <p className="truncate text-xs text-neutral-500">
                        {o.items.reduce((a, i) => a + i.qty, 0)} items · {timeAgo(o.createdAt)}
                      </p>
                    </div>
                    <StatusBadge value={o.status} />
                    <span className="text-sm font-bold tabular-nums">{formatUSD(Number(o.total))}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Watchlist preview */}
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold">Watching</h2>
            <Link href="/watchlist" className="inline-flex items-center text-[13px] text-neutral-500 hover:text-neutral-900">
              View all <ChevronRight className="size-4" />
            </Link>
          </div>
          {watchlistPreview.length === 0 ? (
            <div className="space-y-2 py-4 text-center text-sm text-neutral-500">
              <p>Nothing saved yet. Heart any product to watch its price.</p>
              <Button size="sm" variant="outline" asChild><Link href="/">Discover products</Link></Button>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3">
              {watchlistPreview.map((w) => (
                <li key={w.id}>
                  <Link href={`/product/${w.product.slug}`} className="group block">
                    <span className="relative block aspect-square overflow-hidden rounded-lg bg-neutral-100">
                      <Image src={w.product.image} alt="" fill sizes="240px" className="object-cover" />
                    </span>
                    <span className="mt-1.5 line-clamp-2 block text-[13px] font-medium group-hover:underline">
                      {w.product.title}
                    </span>
                    <span className="text-[13px] font-bold tabular-nums">{formatUSD(Number(w.product.price))}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Account health */}
        <Card className="space-y-2 p-4">
          <h2 className="text-sm font-bold">Account at a glance</h2>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg bg-neutral-100 p-3 dark:bg-neutral-800">
              <dt className="text-xs text-neutral-500">Unread notifications</dt>
              <dd className="text-lg font-black tabular-nums">{unreadNotifications}</dd>
            </div>
            <div className="rounded-lg bg-neutral-100 p-3 dark:bg-neutral-800">
              <dt className="text-xs text-neutral-500">Reviews written</dt>
              <dd className="text-lg font-black tabular-nums">{reviewCount}</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" variant="outline" asChild><Link href={base("/notifications")}>Notifications</Link></Button>
            <Button size="sm" variant="outline" asChild><Link href={base("/settings")}>Personal info</Link></Button>
          </div>
        </Card>

        {/* Selling shortcut */}
        <Card className="space-y-2 bg-neutral-900 p-4 text-white dark:bg-neutral-800">
          <p className="flex items-center gap-1.5 text-sm font-bold"><Store className="size-4" /> {storeCount > 0 ? `My store · ${activeListings} live listing${activeListings === 1 ? "" : "s"}` : "Sell on YS"}</p>
          <p className="text-[13px] text-white/80">
            {storeCount > 0
              ? "Manage listings, sales, payouts and your storefront — all inside My YS."
              : "One account to buy and sell. Open a store in minutes, list anything."}
          </p>
          <div className="flex flex-wrap gap-2">
            {storeCount > 0 ? (
              <>
                <Button size="sm" asChild className="w-fit bg-white text-neutral-900 hover:bg-white/90">
                  <Link href={base("/listings")}>My listings</Link>
                </Button>
                <Button size="sm" variant="outline" asChild className="w-fit border-white/30 text-white hover:bg-white/10 hover:text-white">
                  <Link href={base("/store")}>Customize store</Link>
                </Button>
              </>
            ) : (
              <Button size="sm" asChild className="w-fit bg-white text-neutral-900 hover:bg-white/90">
                <Link href={base("/start-selling")}>Open a store</Link>
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
