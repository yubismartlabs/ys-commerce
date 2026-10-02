"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Ruler, Store, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorCard } from "@/components/commerce/query-error";
import { SizePickerSheet } from "@/components/account/size-picker-sheet";
import { BrandPickerSheet } from "@/components/account/brand-picker-sheet";
import { readEnvelope } from "@/lib/api/client";
import type { PreferenceKind } from "@/lib/shopping-preferences";

type Prefs = { sizes: string[]; brands: string[] };
type Meta = { maxSizes: number; maxBrands: number; brands: string[] };

const KEY = ["shopping-preferences"];

export function ShoppingPreferences() {
  const qc = useQueryClient();
  const [picking, setPicking] = useState<PreferenceKind | null>(null);

  const query = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const envelope = await readEnvelope<Prefs>(await fetch("/api/v1/account/shopping-preferences"));
      return {
        sizes: envelope.data?.sizes ?? [],
        brands: envelope.data?.brands ?? [],
        meta: {
          maxSizes: Number(envelope.meta?.maxSizes ?? 24),
          maxBrands: Number(envelope.meta?.maxBrands ?? 40),
          brands: (envelope.meta?.brands as string[]) ?? [],
        } as Meta,
      };
    },
    retry: false,
  });

  const add = useMutation({
    mutationFn: async ({ kind, value, values }: { kind: PreferenceKind; value?: string; values?: string[] }) => {
      const res = await fetch("/api/v1/account/shopping-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values ? { kind, values } : { kind, value }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Couldn't save that.");
      return json?.data as { value?: string; added?: string[]; alreadySaved?: boolean };
    },
    onSuccess: (d, vars) => {
      // A multi-select commit reports its own count; a single pick is either
      // new or a no-op (the sheet already closed on it).
      const count = vars.values ? d?.added?.length ?? 0 : d?.alreadySaved ? 0 : 1;
      if (count > 0) {
        const noun = vars.kind === "SIZE" ? "size" : "brand";
        toast.success(`${count} ${noun}${count === 1 ? "" : "s"} saved.`);
      }
      qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't save that."),
  });

  const remove = useMutation({
    mutationFn: async ({ kind, value }: { kind: PreferenceKind; value: string }) => {
      const res = await fetch(
        `/api/v1/account/shopping-preferences/${kind}/${encodeURIComponent(value)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Couldn't remove that.");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't remove that."),
  });

  const sizes = query.data?.sizes ?? [];
  const brands = query.data?.brands ?? [];
  const meta = query.data?.meta;
  const sizeLimit = meta?.maxSizes ?? 24;
  const brandLimit = meta?.maxBrands ?? 40;
  const busy = add.isPending || remove.isPending;

  const section = (
    kind: PreferenceKind,
    title: string,
    help: string,
    icon: React.ElementType,
    values: string[],
    limit: number,
    verb: string,
    empty: string
  ) => {
    const Icon = icon;
    const full = values.length >= limit;
    return (
      <Card className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="flex items-center gap-1.5 font-bold">
              <Icon className="size-4" /> {title}
            </p>
            <p className="text-xs text-neutral-500">{help}</p>
          </div>
          <span className="shrink-0 text-xs text-neutral-400">
            {values.length}/{limit}
          </span>
        </div>

        {values.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {values.map((v) => (
              <span
                key={v}
                className="inline-flex items-center gap-1 rounded-full border border-neutral-200 py-1 pl-2.5 pr-1 text-sm dark:border-neutral-700"
              >
                {v}
                <button
                  type="button"
                  aria-label={`Remove ${v}`}
                  disabled={busy}
                  onClick={() => remove.mutate({ kind, value: v })}
                  className="rounded-full p-0.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white"
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-neutral-200 px-3 py-3 text-sm text-neutral-500 dark:border-neutral-700">
            {empty}
          </p>
        )}

        <Button
          size="sm"
          variant="outline"
          disabled={busy || full}
          onClick={() => setPicking(kind)}
        >
          <Plus className="size-4" /> {verb}
        </Button>
        {full ? (
          <p className="text-[11px] text-neutral-400">
            That&apos;s the limit. Remove one to add another.
          </p>
        ) : null}
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {query.isError ? (
        <QueryErrorCard error={query.error} what="preferences" onRetry={() => query.refetch()} />
      ) : null}
      {query.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {section(
            "SIZE",
            "Sizes",
            "We flag the options that fit you.",
            Ruler,
            sizes,
            sizeLimit,
            "Add size",
            "No sizes yet. Add your shirt, trouser or shoe size and we’ll mark the matching option on every listing."
          )}
          {section(
            "BRAND",
            "Brands",
            "Their listings get highlighted for you.",
            Store,
            brands,
            brandLimit,
            "Add brand",
            "No brands yet. Pick a few favourites and we’ll point you straight to them."
          )}
        </div>
      )}

      <SizePickerSheet
        open={picking === "SIZE"}
        onOpenChange={(open) => !open && setPicking(null)}
        saved={sizes}
        atLimit={sizes.length >= sizeLimit}
        onPick={(size) => add.mutate({ kind: "SIZE", value: size })}
      />
      <BrandPickerSheet
        open={picking === "BRAND"}
        onOpenChange={(open) => !open && setPicking(null)}
        brands={meta?.brands ?? []}
        saved={brands}
        atLimit={brands.length >= brandLimit}
        pending={add.isPending}
        onCommit={(picked) => add.mutate({ kind: "BRAND", values: picked })}
      />

      {add.isPending ? (
        <p className="flex items-center gap-1.5 text-xs text-neutral-500">
          <Loader2 className="size-3.5 animate-spin" /> Saving…
        </p>
      ) : null}
    </div>
  );
}