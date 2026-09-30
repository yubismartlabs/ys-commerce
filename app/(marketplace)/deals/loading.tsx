import { ProductGridSkeleton } from "@/components/commerce/skeletons";

export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="h-28 w-full rounded-xl bg-neutral-200 dark:bg-neutral-800" />
      <ProductGridSkeleton count={8} />
    </div>
  );
}
