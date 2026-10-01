"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/refine/ui";
import { QueryErrorCard } from "@/components/commerce/query-error";
import { apiGet } from "@/lib/api/client";
import { formatUSD, timeAgo } from "@/lib/format";
import { ProductForm } from "@/components/products/product-form";
import { useAccountBase } from "@/lib/account-url";

type Detail = {
  id: string;
  title: string;
  description: string | null;
  image: string;
  images: string[];
  specs: Array<{ k: string; v: string }> | null;
  price: number;
  compareAt: number | null;
  category: string;
  brand: string | null;
  tags: string[];
  badge: string | null;
  freeShipping: boolean;
  status: string;
  ratingAvg: number;
  ratingCount: number;
  soldCount: number;
  updatedAt: string;
  store: { id: string; name: string };
  variants: Array<{ name: string; sku: string | null; price: number | null; image: string | null; stock: number }>;
};

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const base = useAccountBase();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const query = useQuery({
    queryKey: ["selling-product", id],
    queryFn: () => apiGet<Detail>(`/api/v1/account/selling/products/${id}`),
    retry: false,
  });
  const p = query.data;

  const submit = async (values: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/account/selling/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Save failed.");
      toast.success("Listing updated.");
      queryClient.invalidateQueries({ queryKey: ["selling-product", id] });
      queryClient.invalidateQueries({ queryKey: ["selling-products"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("Delete this listing? Only listings with no orders can be deleted.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/account/selling/products/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Delete failed.");
      toast.success("Listing deleted.");
      router.push(`${base}/listings`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  };

  if (query.isLoading) return <Card className="p-6 text-sm text-neutral-500">Loading listing…</Card>;
  if (query.isError || !p) {
    return <QueryErrorCard error={query.error} what="listing" backHref={`${base}/listings`} onRetry={() => query.refetch()} />;
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild className="gap-1">
        <Link href={`${base}/listings`}><ArrowLeft className="size-4" /> Listings</Link>
      </Button>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="line-clamp-1 text-xl font-bold">{p.title}</h1>
        <StatusBadge value={p.status} />
        <span className="text-sm text-neutral-500">
          ★ {p.ratingAvg.toFixed(1)} ({p.ratingCount}) · {p.soldCount} sold · {formatUSD(Number(p.price))}
        </span>
      </div>
      <p className="text-xs text-neutral-400">
        {p.status === "TAKEDOWN" ? "Taken down — contact support to restore." : `Updated ${timeAgo(p.updatedAt)}`}
      </p>
      <ProductForm
        stores={[{ id: p.store.id, name: p.store.name }]}
        defaults={{
          title: p.title,
          description: p.description ?? "",
          image: p.image,
          imagesText: (p.images ?? []).join("\n"),
          specsText: p.specs ? JSON.stringify(p.specs) : "",
          price: String(p.price),
          compareAt: p.compareAt === null ? "" : String(p.compareAt),
          category: p.category,
          brand: p.brand ?? "",
          tagsText: (p.tags ?? []).join(", "),
          badge: p.badge ?? "",
          freeShipping: p.freeShipping,
          status: p.status,
          variants: (p.variants ?? []).map((v) => ({
            name: v.name,
            sku: v.sku ?? "",
            price: v.price === null ? "" : String(v.price),
            image: v.image ?? "",
            stock: String(v.stock),
          })),
        }}
        isCreate={false}
        saving={saving}
        onSubmit={submit}
      />
      <Separator />
      <Button size="sm" variant="destructive" disabled={deleting} onClick={remove} className="gap-1.5">
        {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Delete listing
      </Button>
    </div>
  );
}
