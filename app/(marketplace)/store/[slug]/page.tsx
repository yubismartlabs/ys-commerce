import { getProducts } from "@/lib/mocks/catalog";
import { ProductCard } from "@/components/commerce/product-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function StorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const list = await getProducts();
  return (
    <div className="space-y-4">
      <Card className="flex items-center justify-between bg-neutral-900 p-6 text-white">
        <div>
          <p className="text-xl font-bold">{slug.replace(/-/g, " ")}</p>
          <p className="text-sm text-white/70">97.4% positive · 12k followers (mock)</p>
        </div>
        <Button className="bg-ali-red text-white hover:bg-ali-red-dark">Follow</Button>
      </Card>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {list.slice(0, 8).map((p) => (
          <ProductCard key={p.slug} product={p} />
        ))}
      </div>
    </div>
  );
}
