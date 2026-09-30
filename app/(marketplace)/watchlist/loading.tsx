import { ProductGridSkeleton } from "@/components/commerce/skeletons";

export default function Loading() {
  return (
    <div className="space-y-3" aria-busy="true">
      <div className="h-7 w-40 rounded-lg bg-neutral-200 dark:bg-neutral-800" />
      <ProductGridSkeleton count={6} className="sm:grid-cols-2 xl:grid-cols-3" />
    </div>
  );
}
