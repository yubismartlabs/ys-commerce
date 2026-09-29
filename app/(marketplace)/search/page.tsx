import { getProducts } from "@/lib/mocks/catalog";
import { ProductCard } from "@/components/commerce/product-card";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const params = await searchParams;
  const list = await getProducts({ search: params.q, category: params.category });

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <aside className="hidden lg:block">
        <Card className="space-y-4 p-4 text-sm">
          <div>
            <p className="mb-2 font-bold">Filters (UI mock)</p>
            <div className="grid gap-2">
              <Input placeholder="Min price (USD)" inputMode="decimal" />
              <Input placeholder="Max price (USD)" inputMode="decimal" />
              <Button variant="outline" size="sm">Apply</Button>
            </div>
          </div>
          <div className="grid gap-1.5">
            <p className="font-semibold">Shipping</p>
            <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" defaultChecked /> Free shipping</label>
            <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" /> Choice items</label>
            <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" /> 4★ & up</label>
          </div>
        </Card>
      </aside>
      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-bold">
            {params.q ? `Results for "${params.q}"` : params.category ? params.category : "All products"}
          </h1>
          <Badge variant="secondary">{list.length} items</Badge>
        </div>
        {list.length === 0 ? (
          <Card className="p-10 text-center text-sm text-neutral-500">No results. Try another keyword.</Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {list.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
