"use client";

import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { discountPct, formatSold, formatUSD } from "@/lib/format";
import { RatingStars } from "@/components/commerce/rating-stars";
import { cn } from "@/lib/utils";

/** Shoppable citation as returned by /api/v1/ai/chat (superset-safe). */
export type AssistantProduct = {
  slug: string;
  title: string;
  price: number;
  image: string;
  ratingAvg: number;
  compareAt?: number | null;
  soldCount?: number;
  ratingCount?: number;
  badge?: string | null;
  freeShipping?: boolean;
};

function pctOf(p: AssistantProduct): number | null {
  return discountPct(p.price, p.compareAt ?? undefined);
}

/**
 * Alexa-style product carousel: horizontal snap-scroll of storefront-like
 * cards inside the chat. Whole card links to the product page.
 */
export function ProductCarousel({ items }: { items: AssistantProduct[] }) {
  if (items.length === 0) return null;
  return (
    <div
      className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 py-1"
      aria-label="Recommended products"
    >
      {items.map((p) => {
        const pct = pctOf(p);
        return (
          <Link
            key={p.slug}
            href={`/product/${p.slug}`}
            className="group w-[168px] shrink-0 snap-start overflow-hidden rounded-xl border bg-white transition hover:border-ali-red hover:shadow-md"
          >
            <div className="relative aspect-square overflow-hidden bg-neutral-100">
              <Image
                src={p.image}
                alt={p.title}
                fill
                sizes="168px"
                className="object-cover transition duration-300 group-hover:scale-105"
              />
              {pct ? (
                <Badge className="absolute left-1.5 top-1.5 rounded-md bg-ali-sale px-1.5 text-[11px] font-bold text-white">
                  -{pct}%
                </Badge>
              ) : null}
              {p.badge ? (
                <Badge
                  variant="secondary"
                  className={cn(
                    "absolute right-1.5 top-1.5 rounded-md px-1.5 text-[11px] font-semibold",
                    p.badge === "Choice" && "bg-orange-100 text-ali-orange-ink"
                  )}
                >
                  {p.badge}
                </Badge>
              ) : null}
            </div>
            <div className="space-y-1 p-2">
              <p className="line-clamp-2 min-h-8 text-xs leading-4 text-neutral-800">{p.title}</p>
              <div className="flex items-center gap-1 text-[11px] text-neutral-500">
                <RatingStars rating={p.ratingAvg} />
                <span>{p.ratingAvg.toFixed(1)}</span>
                {typeof p.soldCount === "number" ? (
                  <>
                    <span>·</span>
                    <span>{formatSold(p.soldCount)}</span>
                  </>
                ) : null}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-base font-extrabold text-ali-red">{formatUSD(p.price)}</span>
                {p.compareAt ? (
                  <span className="text-[11px] text-neutral-400 line-through">{formatUSD(p.compareAt)}</span>
                ) : null}
              </div>
              {p.freeShipping ? (
                <p className="text-[11px] font-medium text-emerald-600">Free shipping</p>
              ) : null}
              <span className="block rounded-full bg-ali-red/10 py-1 text-center text-[11px] font-bold text-ali-red group-hover:bg-ali-red group-hover:text-white">
                View product
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

/**
 * Alexa-style side-by-side comparison for "X vs Y" questions.
 * Columns per product, rows per attribute, verdict row at the bottom.
 */
export function CompareTable({ items, verdict }: { items: AssistantProduct[]; verdict?: string }) {
  const cols = items.slice(0, 3);
  if (cols.length < 2) return <ProductCarousel items={items} />;
  const rows: Array<{ label: string; render: (p: AssistantProduct) => React.ReactNode }> = [
    { label: "Price", render: (p) => <span className="font-extrabold text-ali-red">{formatUSD(p.price)}</span> },
    {
      label: "Was",
      render: (p) => (p.compareAt ? <span className="text-neutral-400 line-through">{formatUSD(p.compareAt)}</span> : <span className="text-neutral-300">—</span>),
    },
    {
      label: "Rating",
      render: (p) => (
        <span className="inline-flex items-center gap-1">
          <RatingStars rating={p.ratingAvg} /> {p.ratingAvg.toFixed(1)}
        </span>
      ),
    },
    {
      label: "Sold",
      render: (p) => (typeof p.soldCount === "number" ? formatSold(p.soldCount) : "—"),
    },
    {
      label: "Shipping",
      render: (p) => (p.freeShipping ? <span className="font-medium text-emerald-600">Free</span> : "Paid"),
    },
  ];
  return (
    <div className="overflow-x-auto rounded-xl border bg-white" aria-label="Product comparison">
      <table className="w-full min-w-60 border-collapse text-xs">
        <thead>
          <tr>
            <th className="w-16 p-0" aria-hidden />
            {cols.map((p) => (
              <th key={p.slug} className="min-w-28 p-2 align-top font-normal">
                <Link href={`/product/${p.slug}`} className="group block space-y-1">
                  <span className="relative mx-auto block aspect-square w-16 overflow-hidden rounded-lg bg-neutral-100">
                    <Image src={p.image} alt={p.title} fill sizes="64px" className="object-cover" />
                  </span>
                  <span className="line-clamp-2 block leading-4 text-neutral-800 group-hover:text-ali-red">{p.title}</span>
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t">
              <th scope="row" className="p-2 text-left font-semibold text-neutral-500">
                {r.label}
              </th>
              {cols.map((p) => (
                <td key={p.slug} className="p-2 text-center">
                  {r.render(p)}
                </td>
              ))}
            </tr>
          ))}
          <tr className="border-t">
            <th scope="row" aria-hidden className="p-2" />
            {cols.map((p) => (
              <td key={p.slug} className="p-2 text-center">
                <Link
                  href={`/product/${p.slug}`}
                  className="block rounded-full bg-ali-red py-1 text-[11px] font-bold text-white hover:bg-ali-red-dark"
                >
                  View
                </Link>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      {verdict ? (
        <p className="border-t bg-ali-red/5 px-3 py-2 text-xs">
          <strong>Verdict:</strong> {verdict}
        </p>
      ) : null}
    </div>
  );
}
