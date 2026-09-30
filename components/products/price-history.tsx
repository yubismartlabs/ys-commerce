"use client";

import { useQuery } from "@tanstack/react-query";
import { TrendingDown } from "lucide-react";
import { readData } from "@/lib/api/client";
import { formatUSD } from "@/lib/format";

type History = {
  points: Array<{ price: number; at: string }>;
  low: number | null;
  high: number | null;
  current: number;
  hasRange: boolean;
};

/**
 * Price history. A strikethrough "was $45" only means something if $45 was
 * ever the real price — this is the trust signal behind the discount badge.
 */
export function PriceHistory({ slug }: { slug: string }) {
  const query = useQuery({
    queryKey: ["price-history", slug],
    queryFn: async () => readData<History>(await fetch(`/api/v1/products/${slug}/price-history`)),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const h = query.data;
  // One data point can't show a trend; stay quiet rather than imply one.
  if (!h || !h.hasRange || h.points.length < 2) return null;

  const atFloor = Math.abs(h.current - (h.low ?? 0)) < 0.01;

  return (
    <div className="rounded-lg bg-neutral-100 p-3 dark:bg-neutral-800">
      <p className="flex flex-wrap items-center gap-1.5 text-xs">
        <TrendingDown className="size-3.5 text-neutral-500" />
        <span className="font-semibold">Price history</span>
        <span className="text-neutral-600 dark:text-neutral-300">
          was {formatUSD(h.high ?? 0)} · now {formatUSD(h.current)}
        </span>
        {atFloor ? (
          <span className="ml-auto rounded bg-emerald-500/10 px-1.5 py-0.5 font-semibold text-emerald-700 dark:text-emerald-400">
            Lowest price
          </span>
        ) : null}
      </p>
      <PriceSparkline points={h.points} low={h.low ?? 0} high={h.high ?? 0} />
    </div>
  );
}

function PriceSparkline({
  points,
  low,
  high,
}: {
  points: Array<{ price: number; at: string }>;
  low: number;
  high: number;
}) {
  const W = 240;
  const H = 40;
  const span = high - low || 1;
  const step = points.length > 1 ? W / (points.length - 1) : W;

  const coords = points.map((p, i) => {
    const x = points.length > 1 ? i * step : W / 2;
    const y = H - ((p.price - low) / span) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mt-1.5 h-10 w-full"
      role="img"
      aria-label={`Price over time, from ${formatUSD(high)} down to ${formatUSD(points[points.length - 1]?.price ?? high)}`}
      preserveAspectRatio="none"
    >
      <polyline
        points={coords.join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-neutral-400"
        vectorEffect="non-scaling-stroke"
      />
      {coords.length > 0 ? (
        <circle
          cx={coords[coords.length - 1].split(",")[0]}
          cy={coords[coords.length - 1].split(",")[1]}
          r="2.5"
          className="fill-ali-red"
        />
      ) : null}
    </svg>
  );
}
