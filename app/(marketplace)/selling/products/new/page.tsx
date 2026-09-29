"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProductForm } from "@/components/products/product-form";

export default function NewProductPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const storesQuery = useQuery({
    queryKey: ["selling-stores"],
    queryFn: async (): Promise<Array<{ id: string; name: string }>> => {
      const res = await fetch("/api/v1/selling/products?pageSize=1");
      if (!res.ok) throw new Error("Couldn't load stores.");
      return ((await res.json()).meta?.stores ?? []) as Array<{ id: string; name: string }>;
    },
    retry: false,
  });
  const stores = storesQuery.data ?? [];

  const submit = async (values: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/selling/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Create failed.");
      toast.success("Listing created as draft.");
      router.push(`/selling/products/${json.data.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed.");
    } finally {
      setSaving(false);
    }
  };

  if (storesQuery.isLoading) return <Card className="p-6 text-sm text-neutral-500">Loading…</Card>;
  if (storesQuery.isError) {
    return (
      <Card className="space-y-2 p-6 text-sm text-neutral-500">
        <p>Open a store before listing products.</p>
        <Button size="sm" variant="outline" asChild><Link href="/selling/onboarding">Open a store</Link></Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild className="gap-1">
        <Link href="/selling/listings"><ArrowLeft className="size-4" /> Listings</Link>
      </Button>
      <h1 className="text-xl font-bold">New listing</h1>
      <ProductForm stores={stores} defaults={{}} isCreate saving={saving} onSubmit={submit} />
      {saving ? <p className="flex items-center gap-2 text-sm text-neutral-500"><Loader2 className="size-4 animate-spin" /> Creating…</p> : null}
    </div>
  );
}
