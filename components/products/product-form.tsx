"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type ProductFormVariant = { name: string; sku: string; price: string; image: string; stock: string };
export type ProductFormValues = {
  title: string;
  description: string;
  image: string;
  imagesText: string;
  specsText: string;
  price: string;
  compareAt: string;
  category: string;
  badge: string;
  freeShipping: boolean;
  storeId: string;
  status: string;
  variants: ProductFormVariant[];
};

const blankVariant = (): ProductFormVariant => ({ name: "", sku: "", price: "", image: "", stock: "0" });

/** Seller listing form (create + edit). Images/specs as text areas, variants as rows. */
export function ProductForm({
  stores,
  defaults,
  isCreate,
  saving,
  onSubmit,
}: {
  stores: Array<{ id: string; name: string }>;
  defaults: Partial<ProductFormValues>;
  isCreate: boolean;
  saving: boolean;
  onSubmit: (values: Record<string, unknown>) => void;
}) {
  const [v, setV] = useState<ProductFormValues>({
    title: "",
    description: "",
    image: "",
    imagesText: "",
    specsText: "",
    price: "",
    compareAt: "",
    category: "",
    badge: "",
    freeShipping: true,
    storeId: stores[0]?.id ?? "",
    status: "DRAFT",
    variants: [],
    ...defaults,
  });
  // Defaults are final at mount (parents render the form only once loaded).
  const set = <K extends keyof ProductFormValues>(k: K, val: ProductFormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: val }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (v.title.trim().length < 2) return toast.error("Title needs 2+ characters.");
    if (!v.image.trim()) return toast.error("Cover image URL is required.");
    const price = Number(v.price);
    if (!(price > 0)) return toast.error("Price must be above 0.");
    if (!v.category.trim()) return toast.error("Category is required.");
    if (isCreate && !v.storeId) return toast.error("Pick a store.");

    const images = v.imagesText.split("\n").map((s) => s.trim()).filter(Boolean);
    let specs: Array<{ k: string; v: string }> = [];
    if (v.specsText.trim()) {
      try {
        const parsed: unknown = JSON.parse(v.specsText);
        if (!Array.isArray(parsed)) throw new Error("specs must be a JSON array");
        specs = parsed.map((s) => ({ k: String((s as { k: unknown }).k ?? ""), v: String((s as { v: unknown }).v ?? "") }));
      } catch {
        return toast.error('Specs must be JSON like [{"k":"Brand","v":"YS"}].');
      }
    }
    const variants = v.variants
      .filter((x) => x.name.trim())
      .map((x) => ({
        name: x.name.trim(),
        ...(x.sku.trim() ? { sku: x.sku.trim() } : {}),
        ...(x.price !== "" ? { price: Number(x.price) } : {}),
        ...(x.image.trim() ? { image: x.image.trim() } : {}),
        stock: Math.max(0, Math.floor(Number(x.stock) || 0)),
      }));

    onSubmit({
      title: v.title.trim(),
      ...(v.description.trim() ? { description: v.description.trim() } : { description: null }),
      image: v.image.trim(),
      images,
      specs,
      price,
      ...(v.compareAt !== "" ? { compareAt: Number(v.compareAt) } : { compareAt: null }),
      category: v.category.trim().toLowerCase(),
      ...(v.badge.trim() ? { badge: v.badge.trim() } : { badge: null }),
      freeShipping: v.freeShipping,
      ...(isCreate ? { storeId: v.storeId } : {}),
      ...(!isCreate ? { status: v.status } : {}),
      variants,
    });
  };

  return (
    <form onSubmit={submit}>
      <Card className="grid gap-3 p-5">
        {isCreate ? (
          <div className="grid gap-1">
            <label className="text-sm font-medium">Store</label>
            <Select value={v.storeId} onValueChange={(x) => set("storeId", x)}>
              <SelectTrigger><SelectValue placeholder="Pick a store" /></SelectTrigger>
              <SelectContent>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="grid gap-1">
            <label className="text-sm font-medium">Status</label>
            <Select value={v.status} onValueChange={(x) => set("status", x)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DRAFT">DRAFT</SelectItem>
                <SelectItem value="ACTIVE">ACTIVE</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="grid gap-1">
          <label className="text-sm font-medium">Title</label>
          <Input value={v.title} onChange={(e) => set("title", e.target.value)} maxLength={140} placeholder="Wireless Bluetooth Earbuds…" />
        </div>
        <div className="grid gap-1">
          <label className="text-sm font-medium">Description</label>
          <Textarea value={v.description} onChange={(e) => set("description", e.target.value)} rows={4} maxLength={5000} />
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="grid gap-1">
            <label className="text-sm font-medium">Price (USD)</label>
            <Input value={v.price} onChange={(e) => set("price", e.target.value)} inputMode="decimal" placeholder="12.49" />
          </div>
          <div className="grid gap-1">
            <label className="text-sm font-medium">Compare-at (USD)</label>
            <Input value={v.compareAt} onChange={(e) => set("compareAt", e.target.value)} inputMode="decimal" placeholder="29.99" />
          </div>
          <div className="grid gap-1">
            <label className="text-sm font-medium">Category</label>
            <Input value={v.category} onChange={(e) => set("category", e.target.value)} placeholder="electronics" maxLength={60} />
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid gap-1">
            <label className="text-sm font-medium">Cover image URL</label>
            <Input value={v.image} onChange={(e) => set("image", e.target.value)} placeholder="https://…" />
          </div>
          <div className="grid gap-1">
            <label className="text-sm font-medium">Badge (optional)</label>
            <Input value={v.badge} onChange={(e) => set("badge", e.target.value)} placeholder="Hot" maxLength={20} />
          </div>
        </div>
        <div className="grid gap-1">
          <label className="text-sm font-medium">Gallery URLs (one per line, max 10)</label>
          <Textarea value={v.imagesText} onChange={(e) => set("imagesText", e.target.value)} rows={3} placeholder={"https://…/1.jpg\nhttps://…/2.jpg"} />
        </div>
        <div className="grid gap-1">
          <label className="text-sm font-medium">Specs JSON (optional)</label>
          <Textarea value={v.specsText} onChange={(e) => set("specsText", e.target.value)} rows={2} className="font-mono text-xs" placeholder='[{"k":"Brand","v":"YS"}]' />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox checked={v.freeShipping} onCheckedChange={(x) => set("freeShipping", x === true)} /> Free shipping
        </label>

        <div className="grid gap-2 border-t pt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold">Variants ({v.variants.length})</p>
            <Button type="button" size="sm" variant="outline" onClick={() => set("variants", [...v.variants, blankVariant()])}>
              <Plus className="size-3.5" /> Add variant
            </Button>
          </div>
          {v.variants.map((x, i) => (
            <div key={i} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-6">
              <Input value={x.name} onChange={(e) => set("variants", v.variants.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} placeholder="Name *" className="sm:col-span-2" />
              <Input value={x.price} onChange={(e) => set("variants", v.variants.map((y, j) => (j === i ? { ...y, price: e.target.value } : y)))} placeholder="Price" inputMode="decimal" />
              <Input value={x.stock} onChange={(e) => set("variants", v.variants.map((y, j) => (j === i ? { ...y, stock: e.target.value } : y)))} placeholder="Stock" inputMode="numeric" />
              <Input value={x.sku} onChange={(e) => set("variants", v.variants.map((y, j) => (j === i ? { ...y, sku: e.target.value } : y)))} placeholder="SKU" />
              <div className="flex gap-2 sm:col-span-5">
                <Input value={x.image} onChange={(e) => set("variants", v.variants.map((y, j) => (j === i ? { ...y, image: e.target.value } : y)))} placeholder="Image URL (optional)" />
                <Button type="button" size="icon" variant="ghost" onClick={() => set("variants", v.variants.filter((_, j) => j !== i))} aria-label="Remove variant">
                  <Trash2 className="size-4 text-red-600" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div>
          <Button type="submit" disabled={saving} className="bg-ali-red text-white hover:bg-ali-red-dark">
            {saving ? <Loader2 className="size-4 animate-spin" /> : null} {isCreate ? "Create listing (draft)" : "Save changes"}
          </Button>
        </div>
      </Card>
    </form>
  );
}
