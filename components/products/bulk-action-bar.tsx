"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Package, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { readData } from "@/lib/api/client";

type Action = "publish" | "draft" | "adjust_price" | "set_stock";

type Result = {
  changedCount: number;
  skipped: Array<{ slug: string; title: string; reason: string }>;
  skippedCount: number;
  notFoundCount: number;
};

/**
 * Selection-based bulk actions for the listings table.
 *
 * Price changes are a percentage of the CURRENT price, so a seller can apply a
 * markdown repeatedly without the percentages compounding into nonsense.
 */
export function BulkActionBar({
  storeId,
  selected,
  onClear,
}: {
  storeId: string | undefined;
  selected: string[];
  onClear: () => void;
}) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Action>("publish");
  const [percent, setPercent] = useState("-10");
  const [stock, setStock] = useState("0");

  const run = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = { storeId, productIds: selected, action: mode };
      if (mode === "adjust_price") body.percent = Number(percent);
      if (mode === "set_stock") body.stock = Number(stock);
      return readData<Result>(
        await fetch("/api/v1/account/selling/products/bulk-action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      );
    },
    onSuccess: (r) => {
      const bits = [`${r.changedCount} updated`];
      if (r.skippedCount > 0) bits.push(`${r.skippedCount} skipped`);
      if (r.notFoundCount > 0) bits.push(`${r.notFoundCount} not in this store`);
      toast.success(bits.join(" · "));
      if (r.skipped.length > 0) {
        toast.warning(r.skipped[0].reason, { description: `${r.skipped.length} row(s) skipped — see the listing statuses.` });
      }
      onClear();
      queryClient.invalidateQueries({ queryKey: ["selling-products"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Bulk action failed."),
  });

  if (selected.length === 0) return null;

  const disabled = run.isPending || !storeId;

  return (
    <div className="sticky bottom-2 z-10 flex flex-wrap items-center gap-2 rounded-xl border bg-white p-3 shadow-lg dark:bg-neutral-900">
      <span className="text-sm font-semibold">{selected.length} selected</span>

      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          size="sm"
          variant={mode === "publish" ? "default" : "outline"}
          aria-pressed={mode === "publish"}
          onClick={() => setMode("publish")}
        >
          <Send className="size-3.5" /> Publish
        </Button>
        <Button
          size="sm"
          variant={mode === "draft" ? "default" : "outline"}
          aria-pressed={mode === "draft"}
          onClick={() => setMode("draft")}
        >
          Unpublish
        </Button>
        <Button
          size="sm"
          variant={mode === "adjust_price" ? "default" : "outline"}
          aria-pressed={mode === "adjust_price"}
          onClick={() => setMode("adjust_price")}
        >
          <Pencil className="size-3.5" /> Price
        </Button>
        <Button
          size="sm"
          variant={mode === "set_stock" ? "default" : "outline"}
          aria-pressed={mode === "set_stock"}
          onClick={() => setMode("set_stock")}
        >
          <Package className="size-3.5" /> Stock
        </Button>
      </div>

      {mode === "adjust_price" ? (
        <div className="flex items-center gap-1.5">
          <label htmlFor="bulk-pct" className="sr-only">Percentage change</label>
          <Input
            id="bulk-pct"
            type="number"
            min={-90}
            max={100}
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
            className="h-8 w-24"
            placeholder="-10"
          />
          <span className="text-xs text-neutral-500">% of current price</span>
        </div>
      ) : null}

      {mode === "set_stock" ? (
        <div className="flex items-center gap-1.5">
          <label htmlFor="bulk-stock" className="sr-only">Set stock to</label>
          <Input
            id="bulk-stock"
            type="number"
            min={0}
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            className="h-8 w-24"
          />
          <span className="text-xs text-neutral-500">units</span>
        </div>
      ) : null}

      <div className="ml-auto flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={onClear} disabled={run.isPending}>
          Clear
        </Button>
        <Button
          size="sm"
          onClick={() => run.mutate()}
          disabled={disabled}
          className="bg-ali-red text-white hover:bg-ali-red-dark"
        >
          {run.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Apply
        </Button>
      </div>
    </div>
  );
}

/** Header checkbox that selects/deselects the visible page. */
export function SelectAllCheckbox({
  checked,
  indeterminate,
  onToggle,
}: {
  checked: boolean;
  indeterminate: boolean;
  onToggle: () => void;
}) {
  return (
    <Checkbox
      checked={checked || indeterminate}
      // Radix exposes mixed state through the data attribute; `checked`
      // being false with indeterminate set renders the dash.
      aria-label="Select all listings on this page"
      onCheckedChange={onToggle}
      data-state={indeterminate ? "indeterminate" : checked ? "checked" : "unchecked"}
    />
  );
}
