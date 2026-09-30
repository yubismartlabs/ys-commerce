"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BadgePercent,
  ChevronDown,
  Package,
  Plus,
  Scale,
  Star,
  Tag,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { discountPct, formatSold, formatUSD } from "@/lib/format";
import { RatingStars } from "@/components/commerce/rating-stars";
import { useCart } from "@/lib/store/cart";
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
  brand?: string | null;
  category?: string;
  storeId?: string | null;
  storeName?: string | null;
  storeSlug?: string | null;
};

/**
 * User-initiated quick-add (a tap, never an AI order). Checkout re-resolves
 * prices and stock server-side, so the card price is display-only.
 */
function quickAdd(p: AssistantProduct) {
  useCart.getState().add(
    {
      slug: p.slug,
      title: p.title,
      image: p.image,
      price: p.price,
      ...(p.storeId ? { storeId: p.storeId } : {}),
      ...(p.storeName ? { storeName: p.storeName } : {}),
      ...(p.storeSlug ? { storeSlug: p.storeSlug } : {}),
      ...(typeof p.freeShipping === "boolean" ? { freeShipping: p.freeShipping } : {}),
    },
    1
  );
  toast.success("Added to cart", { description: p.title });
}

/**
 * List row: image left, name/price/shipping right, explicit actions.
 * Tapping image or title drills into details in-chat; Add and View are
 * always-visible buttons — no hidden gestures.
 */
function ProductRow({
  p,
  onDrill,
  stagger,
  delay,
}: {
  p: AssistantProduct;
  onDrill: (p: AssistantProduct) => void;
  stagger?: boolean;
  delay?: number;
}) {
  const pct = discountPct(p.price, p.compareAt ?? undefined);
  return (
    <div
      style={stagger ? { animationDelay: `${delay ?? 0}ms` } : undefined}
      className={cn(
        "ai-card flex gap-3 rounded-[18px] p-2.5 ring-1 ring-black/5 transition duration-200 hover:shadow-[0_2px_6px_rgba(20,16,12,0.08),0_10px_28px_rgba(20,16,12,0.10)]",
        stagger && "ai-msg-in"
      )}
    >
      <button
        onClick={() => onDrill(p)}
        aria-label={`Details about ${p.title}`}
        className="relative size-[72px] shrink-0 self-start overflow-hidden rounded-xl bg-neutral-100"
      >
        <Image
          src={p.image}
          alt=""
          fill
          sizes="72px"
          className="object-cover transition duration-300 hover:scale-105"
        />
        {pct ? (
          <span className="absolute bottom-1 left-1 rounded-full bg-ali-sale px-1.5 text-[10px] font-bold text-white shadow">
            -{pct}%
          </span>
        ) : null}
      </button>
      <div className="min-w-0 flex-1 space-y-1 py-0.5">
        <button onClick={() => onDrill(p)} className="block w-full text-left hover:text-ali-red">
          <span className="line-clamp-2 text-[13px] font-semibold leading-snug text-neutral-900">{p.title}</span>
        </button>
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
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span className="text-[15px] font-extrabold tracking-tight text-ali-red">{formatUSD(p.price)}</span>
          {p.compareAt ? (
            <span className="text-[11px] text-neutral-400 line-through">{formatUSD(p.compareAt)}</span>
          ) : null}
          {p.freeShipping ? (
            <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-emerald-700">
              <Truck className="size-3" /> Free shipping
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex w-[68px] shrink-0 flex-col justify-center gap-1.5">
        <button
          onClick={() => quickAdd(p)}
          aria-label={`Add ${p.title} to cart`}
          className="flex items-center justify-center gap-0.5 rounded-full bg-ali-red py-1.5 text-[12px] font-bold text-white shadow-sm transition hover:bg-ali-red-dark active:scale-95"
        >
          <Plus className="size-3.5" /> Add
        </button>
        <Link
          href={`/product/${p.slug}`}
          className="inline-flex items-center justify-center gap-0.5 rounded-full border border-neutral-200 py-1 text-[11px] font-bold text-neutral-700 transition hover:border-ali-red hover:text-ali-red"
        >
          View <ArrowRight className="size-3" />
        </Link>
      </div>
    </div>
  );
}

export function Section({
  title,
  note,
  items,
  onDrill,
  stagger,
  baseDelay,
}: {
  title: string;
  note?: string;
  items: AssistantProduct[];
  onDrill: (p: AssistantProduct) => void;
  stagger?: boolean;
  baseDelay?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, 3);
  return (
    <section aria-label={title} className="space-y-2">
      <div className="flex items-start justify-between gap-2 px-1">
        <div>
          <h4 className="text-[13px] font-extrabold tracking-tight text-neutral-900">{title}</h4>
          {note ? <p className="text-[11px] text-neutral-500">{note}</p> : null}
        </div>
        {items.length > 3 ? (
          <button
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="inline-flex items-center gap-0.5 text-[12px] font-bold text-ali-red hover:text-ali-red-dark"
          >
            {expanded ? "Show less" : `See more (${items.length - 3})`}
            <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")} />
          </button>
        ) : null}
      </div>
      {visible.map((p, i) => (
        <ProductRow key={p.slug} p={p} onDrill={onDrill} stagger={stagger} delay={(baseDelay ?? 0) + i * 55} />
      ))}
    </section>
  );
}

function groupItems(items: AssistantProduct[]): { sections: Array<{ title: string; items: AssistantProduct[] }>; rest: AssistantProduct[] } {
  const byBrand = new Map<string, AssistantProduct[]>();
  const loose: AssistantProduct[] = [];
  for (const p of items) {
    const b = p.brand?.trim();
    if (b) {
      const key = b.toLowerCase();
      byBrand.set(key, [...(byBrand.get(key) ?? []), p]);
    } else {
      loose.push(p);
    }
  }
  const sections: Array<{ title: string; items: AssistantProduct[] }> = [];
  const rest: AssistantProduct[] = [...loose];
  for (const list of byBrand.values()) {
    // A lone brand gets no "Top" section — it joins the overflow list.
    if (list.length >= 2) sections.push({ title: `Top ${list[0].brand!.trim()}`, items: list });
    else rest.push(...list);
  }
  return { sections, rest };
}

/**
 * Grouped list answers: brand sections ("Top Apple") with inline see-more,
 * overflow under "More picks". Two or fewer picks render as a flat list.
 * Row taps drill into details in-chat via onDrill.
 */
export function ProductGroups({
  items,
  onDrill,
  stagger = false,
  sectioned = true,
}: {
  items: AssistantProduct[];
  onDrill: (p: AssistantProduct) => void;
  stagger?: boolean;
  sectioned?: boolean;
}) {
  if (items.length === 0) return null;
  if (!sectioned || items.length <= 2) {
    return (
      <div className="space-y-2">
        {items.map((p, i) => (
          <ProductRow key={p.slug} p={p} onDrill={onDrill} stagger={stagger} delay={60 + i * 55} />
        ))}
      </div>
    );
  }
  const { sections, rest } = groupItems(items);
  // No shared brand at all: one flat list, no section chrome.
  if (sections.length === 0) {
    return (
      <div className="space-y-2">
        {items.slice(0, 3).map((p, i) => (
          <ProductRow key={p.slug} p={p} onDrill={onDrill} stagger={stagger} delay={60 + i * 55} />
        ))}
        <FlatOverflow items={items.slice(3)} onDrill={onDrill} stagger={stagger} />
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {sections.map((s, si) => (
        <Section key={s.title} title={s.title} items={s.items} onDrill={onDrill} stagger={stagger} baseDelay={60 + si * 120} />
      ))}
      {rest.length > 0 ? (
        <Section title="More picks" items={rest} onDrill={onDrill} stagger={stagger} baseDelay={60 + sections.length * 120} />
      ) : null}
    </div>
  );
}

function FlatOverflow({
  items,
  onDrill,
  stagger,
}: {
  items: AssistantProduct[];
  onDrill: (p: AssistantProduct) => void;
  stagger?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;
  return (
    <>
      {expanded
        ? items.map((p, i) => (
            <ProductRow key={p.slug} p={p} onDrill={onDrill} stagger={stagger} delay={i * 55} />
          ))
        : null}
      <button
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-center gap-1 rounded-full border border-neutral-200 bg-white py-2 text-[12px] font-bold text-neutral-700 shadow-sm transition hover:border-ali-red hover:text-ali-red"
      >
        {expanded ? "Show less" : `See more (${items.length})`}
        <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")} />
      </button>
    </>
  );
}

/**
 * Order status cards for "where is my order" answers: number, status,
 * items and per-parcel tracking, deep-linked to the orders tab.
 */
export type AssistantOrder = {
  number: string;
  status: string;
  total: number;
  createdAt: string;
  items: Array<{ title: string; slug: string | null; qty: number; price: number }>;
  shipments: Array<{ storeName: string; status: string; carrier: string | null; trackingNumber: string | null }>;
};

const STATUS_TINT: Record<string, string> = {
  PAID: "bg-amber-100 text-amber-800",
  SHIPPED: "bg-sky-100 text-sky-800",
  IN_TRANSIT: "bg-sky-100 text-sky-800",
  DELIVERED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-neutral-200 text-neutral-600",
  REFUNDED: "bg-neutral-200 text-neutral-600",
};

export function OrderCards({ orders }: { orders: AssistantOrder[] }) {
  if (orders.length === 0) return null;
  return (
    <div className="space-y-2" aria-label="Your orders">
      {orders.map((o) => (
        <div key={o.number} className="ai-card space-y-2 rounded-[18px] p-3 ring-1 ring-black/5">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-xl bg-ali-red/10 text-ali-red">
              <Package className="size-4" />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-[13px] font-extrabold text-neutral-900">Order {o.number}</p>
              <p className="text-[11px] text-neutral-500">
                {new Date(o.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })} · {formatUSD(o.total)}
              </p>
            </div>
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", STATUS_TINT[o.status] ?? "bg-neutral-100 text-neutral-600")}>
              {o.status}
            </span>
          </div>
          <ul className="space-y-0.5">
            {o.items.map((i, k) => (
              <li key={k} className="truncate text-xs text-neutral-600">
                {i.qty}× {i.title}
              </li>
            ))}
          </ul>
          {o.shipments.map((s, k) => (
            <p key={k} className="flex items-center gap-1.5 text-[11px] text-neutral-500">
              <Truck className="size-3.5 shrink-0 text-emerald-600" />
              <span className="truncate">
                {s.storeName} · {s.status}
                {s.trackingNumber ? ` · ${s.carrier ?? "carrier"} ${s.trackingNumber}` : ""}
              </span>
            </p>
          ))}
          <Link
            href="/account?tab=orders"
            className="flex items-center justify-center gap-1 rounded-full border border-neutral-200 py-1.5 text-[12px] font-bold text-neutral-800 transition hover:border-ali-red hover:text-ali-red"
          >
            View in orders <ArrowRight className="size-3.5" />
          </Link>
        </div>
      ))}
    </div>
  );
}

/**
 * Side-by-side comparison for "X vs Y" questions: image-led columns,
 * price hero row, icon attribute rows, sticky verdict bar.
 */
export function CompareTable({ items, verdict, onDrill }: { items: AssistantProduct[]; verdict?: string; onDrill: (p: AssistantProduct) => void }) {
  const cols = items.slice(0, 3);
  if (cols.length < 2) return <ProductGroups items={items} onDrill={onDrill} />;
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
                  <button onClick={() => onDrill(p)} className="group block w-full space-y-1.5" aria-label={`Details about ${p.title}`}>
                    <span className="relative mx-auto block aspect-square w-24 overflow-hidden rounded-2xl bg-neutral-100 ring-1 ring-black/5">
                      <Image src={p.image} alt="" fill sizes="96px" className="object-cover transition duration-500 group-hover:scale-105" />
                    </span>
                    <span className="line-clamp-2 block text-[12px] font-medium leading-snug text-neutral-800 group-hover:text-ali-red">{p.title}</span>
                    <span className="block text-[14px] font-extrabold tracking-tight text-ali-red">{formatUSD(p.price)}</span>
                  </button>
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
