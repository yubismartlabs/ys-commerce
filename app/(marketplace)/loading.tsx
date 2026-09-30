import { Skeleton } from "@/components/ui/skeleton";
import { ProductGridSkeleton } from "@/components/commerce/skeletons";

/** Instant feedback while a marketplace route streams in. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-56 w-full rounded-xl md:h-64" />
      <div className="grid grid-cols-3 gap-3 md:grid-cols-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" style={{ animationDelay: `${i * 30}ms` }} />
        ))}
      </div>
      <ProductGridSkeleton count={10} />
    </div>
  );
}
