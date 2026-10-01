import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { AtSign, CalendarDays, HeartHandshake, Package, Star } from "lucide-react";
import { db } from "@/lib/db";
import { normalizeUsername } from "@/lib/usernames";
import { storeHandle, storeUrl } from "@/lib/stores/url";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RatingStars } from "@/components/commerce/rating-stars";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return { title: `@${normalizeUsername(username)} — seller profile` };
}

/**
 * Public seller profile: handle, stores, follower + listing counts.
 * PII-free — no email, no order data.
 */
export default async function UserProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username: raw } = await params;
  const username = normalizeUsername(raw);
  const user = await db.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      name: true,
      image: true,
      role: true,
      createdAt: true,
      stores: {
        where: { status: "APPROVED" },
        select: {
          id: true,
          name: true,
          slug: true,
          username: true,
          logo: true,
          description: true,
          ratingAvg: true,
          ratingCount: true,
          soldCount: true,
          followerCount: true,
          _count: { select: { products: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!user?.username) notFound();

  const storeIds = user.stores.map((s) => s.id);
  const [followerTotal, activeListings] = await Promise.all([
    storeIds.length > 0 ? db.storeFollow.count({ where: { storeId: { in: storeIds } } }) : Promise.resolve(0),
    storeIds.length > 0 ? db.product.count({ where: { storeId: { in: storeIds }, status: "ACTIVE" } }) : Promise.resolve(0),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card className="flex flex-wrap items-center gap-4 p-5">
        {user.image ? (
          <span className="relative size-16 shrink-0 overflow-hidden rounded-full bg-neutral-100">
            <Image src={user.image} alt="" fill sizes="64px" className="object-cover" />
          </span>
        ) : (
          <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-ali-red text-2xl font-black text-white">
            {(user.name ?? user.username).slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-1.5 text-xl font-black">
            <AtSign className="size-5 text-neutral-400" />{user.username}
          </h1>
          <p className="truncate text-sm text-neutral-500">
            {user.name ?? user.username} · {user.role === "ADMIN" ? "Marketplace team" : user.stores.length > 0 ? "Seller" : "Buyer"}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-neutral-500">
            <span className="inline-flex items-center gap-1"><HeartHandshake className="size-3.5" /> <span className="tabular-nums font-semibold text-neutral-800 dark:text-neutral-200">{followerTotal.toLocaleString()}</span> followers</span>
            <span className="inline-flex items-center gap-1"><Package className="size-3.5" /> <span className="tabular-nums font-semibold text-neutral-800 dark:text-neutral-200">{activeListings}</span> live listings</span>
            <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" /> Joined {user.createdAt.getFullYear()}</span>
          </p>
        </div>
      </Card>

      {user.stores.length === 0 ? (
        <Card className="space-y-2 p-10 text-center text-sm text-neutral-500">
          <p className="flex items-center justify-center gap-1.5 font-semibold text-neutral-700 dark:text-neutral-200"><Star className="size-4" /> No public stores yet</p>
          <p>@{user.username} hasn&apos;t opened a store — anyone can list, so check back soon.</p>
          <Button size="sm" asChild><Link href="/">Discover products</Link></Button>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {user.stores.map((s) => (
            <Link key={s.id} href={storeUrl(s)}>
              <Card className="group flex items-center gap-3 p-4 transition hover:shadow-md">
                {s.logo ? (
                  <span className="relative size-12 shrink-0 overflow-hidden rounded-xl border bg-white">
                    <Image src={s.logo} alt="" fill sizes="48px" className="object-contain" />
                  </span>
                ) : (
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-ali-red text-xl font-black text-white">
                    {s.name.slice(0, 1)}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1 block text-sm font-bold group-hover:underline">{s.name} <span className="font-mono font-semibold text-ali-red">{storeHandle(s)}</span></span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-500">
                    <RatingStars rating={s.ratingAvg} />
                    <span className="tabular-nums">{s.followerCount.toLocaleString()} followers · {s._count.products} items</span>
                  </span>
                  {s.description ? <span className="mt-0.5 line-clamp-1 block text-xs text-neutral-500">{s.description}</span> : null}
                </span>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
