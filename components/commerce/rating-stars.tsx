import { Star, StarHalf } from "lucide-react";
import { cn } from "@/lib/utils";

export function RatingStars({ rating, className }: { rating: number; className?: string }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <span className={cn("inline-flex items-center gap-px text-ali-star", className)} aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => {
        if (i < full) return <Star key={i} className="size-3 fill-current" />;
        if (i === full && half)
          return (
            <span key={i} className="relative inline-flex">
              <Star className="size-3" />
              <StarHalf className="absolute inset-0 size-3 fill-current" />
            </span>
          );
        return <Star key={i} className="size-3 opacity-40" />;
      })}
    </span>
  );
}
