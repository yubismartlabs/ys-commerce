import { Skeleton } from "@/components/ui/skeleton";
import { ProductGridSkeleton } from "@/components/commerce/skeletons";

export default function Loading() {
  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]" aria-busy="true">
      <Skeleton className="hidden h-96 w-full rounded-xl lg:block" />
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <ProductGridSkeleton count={12} className="xl:grid-cols-4" />
      </div>
    </div>
  );
}
