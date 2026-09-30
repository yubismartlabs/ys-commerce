import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Skeletons for route-level loading.tsx boundaries. */

export function ProductGridSkeleton({ count = 10, className }: { count?: number; className?: string }) {
  return (
    <div
      className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5", className)}
      aria-label="Loading products"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="aspect-square w-full rounded-xl" style={{ animationDelay: `${i * 40}ms` }} />
          <Skeleton className="h-3 w-4/5" style={{ animationDelay: `${i * 40 + 20}ms` }} />
          <Skeleton className="h-4 w-1/3" style={{ animationDelay: `${i * 40 + 40}ms` }} />
        </div>
      ))}
    </div>
  );
}

export function PageHeaderSkeleton() {
  return (
    <div className="mb-4 space-y-2">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-4 w-32" />
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-64 w-full rounded-xl", className)} />;
}

export function ProductDetailSkeleton() {
  return (
    <div className="grid animate-pulse gap-4 lg:grid-cols-2" aria-label="Loading product">
      <Skeleton className="aspect-square w-full rounded-xl" />
      <div className="space-y-3">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-14 w-1/2" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" style={{ animationDelay: `${i * 40}ms` }} />
      ))}
    </div>
  );
}
