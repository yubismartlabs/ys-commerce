"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BadgePercent,
  ChevronLeft,
  ChevronRight,
  Package,
  Scale,
  Star,
  Tag,
  Truck,
} from "lucide-react";
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

function CardBadges({ p }: { p: AssistantProduct }) {
  const pct = pctOf(p);
  return (
    <>
      {pct ? (
        <Badge className="absolute left-2.5 top-2.5 rounded-full bg-ali-sale px-2 py-0.5 text-[11px] font-bold text-white shadow-md">
          -{pct}%
        </Badge>
      ) : null}
      {p.badge ? (
        <Badge
          variant="secondary"
          className={cn(
            "absolute right-2.5 top-2.5 rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-md",
            p.badge === "Choice" && "bg-orange-100 text-ali-orange-ink"
          )}
        >
          {p.badge}
        </Badge>
      ) : null}
    </>
  );
}

function CardMeta({ p, large }: { p: AssistantProduct; large?: boolean }) {
  return (
    <div className={cn("space-y-1", large ? "p-4" : "p-3")}>
      <p className={cn("line-clamp-2 min-h-8 font-medium leading-snug text-neutral-900", large ? "text-sm" : "text-[13px]")}>
        {p.title}
      </p>
      <div className="flex items-center gap-1 text-[11px] text-neutral-500">
        <RatingStars rating={p.ratingAvg} />
        <span className="font-semibold text-neutral-700">{p.ratingAvg.toFixed(1)}</span>
        {typeof p.soldCount === "number" ? (
          <>
            <span aria-hidden>·</span>
            <span>{formatSold(p.soldCount)}</span>
          </>
        ) : null}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={cn("font-extrabold tracking-tight text-ali-red", large ? "text-xl" : "text-[17px]")}>
          {formatUSD(p.price)}
        </span>
        {p.compareAt ? (
          <span className="text-[11px] text-neutral-400 line-through">{formatUSD(p.compareAt)}</span>
        ) : null}
      </div>
      <div className="flex items-center justify-between pt-1">
        {p.freeShipping ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
            <Truck className="size-3" /> Free shipping
          </span>
        ) : (
          <span />
        )}
        <span className="inline-flex items-center gap-0.5 text-[12px] font-bold text-ali-red">
          View <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-1" />
        </span>
      </div>
    </div>
  );
}

/**
 * Alexa-style product rail: image-first cards with staggered entrances.
 * The lead pick renders as a full-width hero; the rest ride a snap rail
 * with a card peeking past the edge to invite the swipe.
 */
export function ProductCarousel({ items, stagger = false }: { items: AssistantProduct[]; stagger?: boolean }) {
  const railRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  if (items.length === 0) return null;
  const [hero, ...rest] = items;

  const syncEdges = () => {
    const el = railRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  };

  const nudge = (dir: 1 | -1) => {
    railRef.current?.scrollBy({ left: dir * 440, behavior: "smooth" });
  };

  return (
    <div className="space-y-2.5">
      <Link
        href={`/product/${hero.slug}`}
        style={stagger ? { animationDelay: "60ms" } : undefined}
        className={cn(
          "ai-card group block overflow-hidden rounded-[20px] ring-1 ring-black/5 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_2px_6px_rgba(20,16,12,0.08),0_12px_32px_rgba(20,16,12,0.12)]",
          stagger && "ai-msg-in"
        )}
      >
        <div className="relative aspect-[16/10] overflow-hidden bg-neutral-100">
          <Image
            src={hero.image}
            alt={hero.title}
            fill
            sizes="360px"
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/15 to-transparent" />
          <CardBadges p={hero} />
        </div>
        <CardMeta p={hero} large />
      </Link>
      {rest.length > 0 ? (
        <div className="group/rail relative" aria-label="More recommendations">
          <div
            ref={railRef}
            onScroll={syncEdges}
            className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-2.5 overflow-x-auto scroll-smooth px-1 py-1"
          >
            {rest.map((p, i) => (
              <Link
                key={p.slug}
                href={`/product/${p.slug}`}
                style={stagger ? { animationDelay: `${110 + i * 55}ms` } : undefined}
                className={cn(
                  "ai-card group w-[216px] shrink-0 snap-start overflow-hidden rounded-[20px] ring-1 ring-black/5 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_2px_6px_rgba(20,16,12,0.08),0_12px_32px_rgba(20,16,12,0.12)]",
                  stagger && "ai-msg-in"
                )}
              >
                <div className="relative aspect-[5/4] overflow-hidden bg-neutral-100">
                  <Image
                    src={p.image}
                    alt={p.title}
                    fill
                    sizes="216px"
                    className="object-cover transition duration-500 group-hover:scale-[1.05]"
                  />
                  <CardBadges p={p} />
                </div>
                <CardMeta p={p} />
              </Link>
            ))}
          </div>
          <RailButton dir={-1} hidden={atStart} onNudge={nudge} label="Scroll products left" />
          <RailButton dir={1} hidden={atEnd} onNudge={nudge} label="Scroll products right" />
        </div>
      ) : null}
    </div>
  );
}

function RailButton({
  dir,
  hidden,
  onNudge,
  label,
}: {
  dir: 1 | -1;
  hidden: boolean;
  onNudge: (d: 1 | -1) => void;
  label: string;
}) {
  const Icon = dir === 1 ? ChevronRight : ChevronLeft;
  return (
    <button
      onClick={() => onNudge(dir)}
      aria-label={label}
      tabIndex={hidden ? -1 : 0}
      className={cn(
        "absolute top-[38%] hidden size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-neutral-700 opacity-0 shadow-xl ring-1 ring-black/5 backdrop-blur-md transition duration-200 hover:scale-105 group-hover/rail:opacity-100 md:flex",
        dir === 1 ? "-right-1.5" : "-left-1.5",
        hidden && "pointer-events-none"
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}

/**
 * Side-by-side comparison for "X vs Y" questions: image-led columns,
 * price hero row, icon attribute rows, sticky verdict bar.
 */
export function CompareTable({ items, verdict }: { items: AssistantProduct[]; verdict?: string }) {
  const cols = items.slice(0, 3);
  if (cols.length < 2) return <ProductCarousel items={items} />;
  const rows: Array<{ label: string; icon: React.ReactNode; render: (p: AssistantProduct) => React.ReactNode }> = [
    { label: "Price", icon: <Tag className="size-3.5" />, render: (p) => <span className="text-[15px] font-extrabold tracking-tight text-ali-red">{formatUSD(p.price)}</span> },
    {
      label: "Was",
      icon: <BadgePercent className="size-3.5" />,
      render: (p) => (p.compareAt ? <span className="text-neutral-400 line-through">{formatUSD(p.compareAt)}</span> : <span className="text-neutral-300">—</span>),
    },
    {
      label: "Rating",
      icon: <Star className="size-3.5" />,
      render: (p) => (
        <span className="inline-flex items-center gap-1">
          <RatingStars rating={p.ratingAvg} /> {p.ratingAvg.toFixed(1)}
        </span>
      ),
    },
    {
      label: "Sold",
      icon: <Package className="size-3.5" />,
      render: (p) => (typeof p.soldCount === "number" ? formatSold(p.soldCount) : "—"),
    },
    {
      label: "Shipping",
      icon: <Truck className="size-3.5" />,
      render: (p) =>
        p.freeShipping ? (
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
            <Truck className="size-3" /> Free
          </span>
        ) : (
          "Paid"
        ),
    },
  ];
  return (
    <div className="ai-card overflow-hidden rounded-[20px] ring-1 ring-black/5" aria-label="Product comparison">
      <div className="overflow-x-auto">
        <table className="w-full min-w-60 border-collapse text-xs">
          <thead>
            <tr>
              <th className="w-14 p-0" aria-hidden />
              {cols.map((p) => (
                <th key={p.slug} className="min-w-28 p-3 align-top font-normal">
                  <Link href={`/product/${p.slug}`} className="group block space-y-1.5">
                    <span className="relative mx-auto block aspect-square w-24 overflow-hidden rounded-2xl bg-neutral-100 ring-1 ring-black/5">
                      <Image src={p.image} alt={p.title} fill sizes="96px" className="object-cover transition duration-500 group-hover:scale-105" />
                    </span>
                    <span className="line-clamp-2 block text-[12px] font-medium leading-snug text-neutral-800 group-hover:text-ali-red">{p.title}</span>
                    <span className="block text-[14px] font-extrabold tracking-tight text-ali-red">{formatUSD(p.price)}</span>
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-neutral-100">
                <th scope="row" className="p-2.5 text-left font-semibold text-neutral-500">
                  <span className="inline-flex items-center gap-1.5">{r.icon}{r.label}</span>
                </th>
                {cols.map((p) => (
                  <td key={p.slug} className="p-2.5 text-center">
                    {r.render(p)}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t border-neutral-100">
              <th scope="row" aria-hidden className="p-2.5" />
              {cols.map((p) => (
                <td key={p.slug} className="p-2.5 text-center">
                  <Link
                    href={`/product/${p.slug}`}
                    className="flex items-center justify-center gap-1 rounded-full bg-ali-red py-2 text-[11px] font-bold text-white shadow-sm transition hover:bg-ali-red-dark active:scale-95"
                  >
                    View <ArrowRight className="size-3" />
                  </Link>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      {verdict ? (
        <p className="flex items-start gap-1.5 bg-ali-red/5 px-3.5 py-3 text-xs leading-5">
          <Scale className="mt-0.5 size-3.5 shrink-0 text-ali-red" />
          <span><strong>Verdict:</strong> {verdict}</span>
        </p>
      ) : null}
    </div>
  );
}
