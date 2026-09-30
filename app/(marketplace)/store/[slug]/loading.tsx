import { Skeleton } from "@/components/ui/skeleton";
import { ProductGridSkeleton } from "@/components/commerce/skeletons";

export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="flex gap-3">
        <Skeleton className="h-56 w-20 rounded-xl" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-40 rounded-full" />
        </div>
      </div>
      <ProductGridSkeleton count={6} />
    </div>
  );
}
