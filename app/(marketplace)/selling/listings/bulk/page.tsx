"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BulkListingImport } from "@/components/products/bulk-listing-import";
import { readData } from "@/lib/api/client";

export default function BulkListingsPage() {
  const query = useQuery({
    queryKey: ["selling-stores"],
    queryFn: async () => readData<Array<{ id: string; name: string }>>(await fetch("/api/v1/selling/store")),
    retry: false,
  });

  const stores = query.data ?? [];

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild className="-ml-2 gap-1">
        <Link href="/selling/listings">← Listings</Link>
      </Button>

      {query.isLoading ? (
        <Card className="h-96 animate-pulse bg-neutral-100 dark:bg-neutral-800" aria-label="Loading" />
      ) : query.isError ? (
        <Card className="space-y-2 p-6 text-sm text-neutral-600">
          <p>{query.error instanceof Error ? query.error.message : "Couldn't load your stores."}</p>
          <Button size="sm" variant="outline" asChild><Link href="/selling/onboarding">Open a store</Link></Button>
        </Card>
      ) : stores.length === 0 ? (
        <Card className="space-y-2 p-10 text-center text-sm text-neutral-500">
          <p>You need a store before you can list products.</p>
          <Button size="sm" asChild className="bg-ali-red text-white hover:bg-ali-red-dark">
            <Link href="/selling/onboarding"><Plus className="size-4" /> Open a store</Link>
          </Button>
        </Card>
      ) : (
        <>
          <BulkListingImport stores={stores} />
          <BulkListingHelp />
        </>
      )}
    </div>
  );
}

function BulkListingHelp() {
  return (
    <Card className="space-y-2 p-4 text-sm">
      <p className="font-bold">How the import works</p>
      <ul className="list-disc space-y-1 pl-5 text-neutral-600 dark:text-neutral-300">
        <li>Start from the <span className="font-medium">Template</span> so the column names match.</li>
        <li>
          Press <span className="font-medium">Check file</span> first — it validates every line and shows
          what will be rejected before anything is saved.
        </li>
        <li>
          Bad rows are skipped, not fatal. The report lists each one by line number so you can fix and
          re-import just those.
        </li>
        <li>
          URL slugs are generated from the title and made unique automatically
          (<span className="font-mono text-xs">product</span>, <span className="font-mono text-xs">product-2</span>, …).
        </li>
        <li>
          A row with a SKU gets a single default variant so the SKU stays searchable. For multiple
          options per product, add them on the listing page afterwards.
        </li>
        <li>Imports as <span className="font-medium">drafts</span> by default so you can review before going live.</li>
      </ul>
      <p className="text-xs text-neutral-500">Maximum 500 rows (2MB) per import.</p>
    </Card>
  );
}
