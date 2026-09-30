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

/**
 * Alexa-style product rail: seamless horizontal snap-scroll of soft,
 * Apple-like cards. Whole card links to the product page; chevrons nudge
 * the rail on desktop.
 */
export function ProductCarousel({ items }: { items: AssistantProduct[] }) {
  const railRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  if (items.length === 0) return null;

  const syncEdges = () => {
    const el = railRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  };

  const nudge = (dir: 1 | -1) => {
    railRef.current?.scrollBy({ left: dir * 380, behavior: "smooth" });
  };

  return (
    <div className="group/rail relative" aria-label="Recommended products">
      <div
        ref={railRef}
        onScroll={syncEdges}
        className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-2.5 overflow-x-auto scroll-smooth px-1 py-1"
      >
        {items.map((p) => {
          const pct = pctOf(p);
          return (
            <Link
              key={p.slug}
              href={`/product/${p.slug}`}
              className="group w-[188px] shrink-0 snap-start overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.06)] ring-1 ring-black/5 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(0,0,0,0.08),0_8px_24px_rgba(0,0,0,0.10)]"
            >
              <div className="relative aspect-[5/4] overflow-hidden bg-neutral-100">
                <Image
                  src={p.image}
                  alt={p.title}
                  fill
                  sizes="188px"
                  className="object-cover transition duration-300 group-hover:scale-[1.04]"
                />
                {pct ? (
                  <Badge className="absolute left-2 top-2 rounded-full bg-ali-sale px-2 text-[11px] font-bold text-white shadow-sm">
                    -{pct}%
                  </Badge>
                ) : null}
                {p.badge ? (
                  <Badge
                    variant="secondary"
                    className={cn(
                      "absolute right-2 top-2 rounded-full px-2 text-[11px] font-semibold shadow-sm",
                      p.badge === "Choice" && "bg-orange-100 text-ali-orange-ink"
                    )}
                  >
                    {p.badge}
                  </Badge>
                ) : null}
              </div>
              <div className="space-y-1 p-3">
                <p className="line-clamp-2 min-h-8 text-[13px] font-medium leading-4 text-neutral-900">{p.title}</p>
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
                  <span className="text-[17px] font-extrabold tracking-tight text-ali-red">{formatUSD(p.price)}</span>
                  {p.compareAt ? (
                    <span className="text-[11px] text-neutral-400 line-through">{formatUSD(p.compareAt)}</span>
                  ) : null}
                </div>
                <div className="flex items-center justify-between pt-0.5">
                  {p.freeShipping ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      <Truck className="size-3" /> Free shipping
                    </span>
                  ) : (
                    <span />
                  )}
                  <span className="inline-flex items-center gap-0.5 text-[12px] font-bold text-ali-red">
                    View <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      {items.length > 2 ? (
        <>
          <RailButton dir={-1} hidden={atStart} onNudge={nudge} label="Scroll products left" />
          <RailButton dir={1} hidden={atEnd} onNudge={nudge} label="Scroll products right" />
        </>
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
        "absolute top-1/3 hidden size-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-neutral-700 shadow-lg ring-1 ring-black/5 transition hover:scale-105 md:flex",
        dir === 1 ? "-right-1" : "-left-1",
        hidden && "pointer-events-none opacity-0"
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}

/**
 * Alexa-style side-by-side comparison for "X vs Y" questions.
 * Columns per product, rows per attribute, verdict row at the bottom.
 */
export function CompareTable({ items, verdict }: { items: AssistantProduct[]; verdict?: string }) {
  const cols = items.slice(0, 3);
  if (cols.length < 2) return <ProductCarousel items={items} />;
  const rows: Array<{ label: string; icon: React.ReactNode; render: (p: AssistantProduct) => React.ReactNode }> = [
    { label: "Price", icon: <Tag className="size-3.5" />, render: (p) => <span className="font-extrabold text-ali-red">{formatUSD(p.price)}</span> },
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
      render: (p) => (p.freeShipping ? <span className="font-medium text-emerald-600">Free</span> : "Paid"),
    },
  ];
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.06)] ring-1 ring-black/5" aria-label="Product comparison">
      <div className="overflow-x-auto">
        <table className="w-full min-w-60 border-collapse text-xs">
          <thead>
            <tr>
              <th className="w-16 p-0" aria-hidden />
              {cols.map((p) => (
                <th key={p.slug} className="min-w-28 p-2.5 align-top font-normal">
                  <Link href={`/product/${p.slug}`} className="group block space-y-1.5">
                    <span className="relative mx-auto block aspect-square w-20 overflow-hidden rounded-xl bg-neutral-100 ring-1 ring-black/5">
                      <Image src={p.image} alt={p.title} fill sizes="80px" className="object-cover transition duration-300 group-hover:scale-105" />
                    </span>
                    <span className="line-clamp-2 block text-[12px] font-medium leading-4 text-neutral-800 group-hover:text-ali-red">{p.title}</span>
                    <span className="block text-[13px] font-extrabold text-ali-red">{formatUSD(p.price)}</span>
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
                    className="flex items-center justify-center gap-1 rounded-full bg-ali-red py-1.5 text-[11px] font-bold text-white transition hover:bg-ali-red-dark active:scale-95"
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
        <p className="flex items-start gap-1.5 bg-ali-red/5 px-3 py-2.5 text-xs">
          <Scale className="mt-0.5 size-3.5 shrink-0 text-ali-red" />
          <span><strong>Verdict:</strong> {verdict}</span>
        </p>
      ) : null}
    </div>
  );
}
