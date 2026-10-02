"use client";

import { useMemo, useState } from "react";
import { Check, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * Right-hand sheet for picking brands from what the marketplace actually
 * sells. Multi-select: rows toggle into a pending set, and one button commits
 * the whole selection as a single request.
 *
 * Already-saved rows show a check and cannot be re-added, but they are NOT
 * toggled here — removal belongs to the chip on the page, where the buyer can
 * see everything they have in one place. Two places that remove risks the
 * sheet and the page disagreeing about what is saved.
 */
export function BrandPickerSheet({
  open,
  onOpenChange,
  brands,
  saved,
  atLimit,
  pending,
  onCommit,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  brands: string[];
  saved: string[];
  atLimit: boolean;
  pending: boolean;
  onCommit: (brands: string[]) => void;
}) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);

  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle ? brands.filter((b) => b.toLowerCase().includes(needle)) : brands;
    return [...list].sort((a, b) => a.localeCompare(b));
  }, [brands, q]);

  const close = (next: boolean) => {
    if (!next) {
      setQ("");
      setPicked([]);
    }
    onOpenChange(next);
  };

  const isSaved = (brand: string) => saved.some((s) => s.toLowerCase() === brand.toLowerCase());
  const isPicked = (brand: string) => picked.some((p) => p.toLowerCase() === brand.toLowerCase());

  const toggle = (brand: string) => {
    setPicked((prev) =>
      prev.some((p) => p.toLowerCase() === brand.toLowerCase())
        ? prev.filter((p) => p.toLowerCase() !== brand.toLowerCase())
        : [...prev, brand]
    );
  };

  const commit = () => {
    if (picked.length === 0 || pending) return;
    onCommit(picked);
    close(false);
  };

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="space-y-1 border-b p-5 text-left">
          <SheetTitle>Choose brands</SheetTitle>
          <SheetDescription>
            {brands.length === 0
              ? "No brands to show yet — check back once the marketplace has listings."
              : `Pick from the ${brands.length} brands listed on the marketplace.`}
          </SheetDescription>
        </SheetHeader>

        <div className="border-b p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search brands…"
              aria-label="Search brands"
              className="pl-8"
              autoFocus
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {hits.length === 0 ? (
            <p className="p-4 text-sm text-neutral-500">Nothing matches “{q.trim()}” — try a shorter search.</p>
          ) : (
            hits.map((b) => {
              const done = isSaved(b);
              const checked = done || isPicked(b);
              return (
                <button
                  key={b}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  disabled={done || (atLimit && !checked)}
                  onClick={() => !done && toggle(b)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-normal transition hover:bg-neutral-100 disabled:cursor-default disabled:opacity-100 dark:hover:bg-neutral-800"
                >
                  <Checkbox
                    checked={checked}
                    tabIndex={-1}
                    aria-hidden
                    className={cn(done && "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-600")}
                  />
                  <span className={cn("min-w-0 flex-1 truncate", done && "text-neutral-500")}>{b}</span>
                  {done ? (
                    <span className="shrink-0 text-[11px] font-medium text-neutral-400">Saved</span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>

        <SheetFooter className="border-t p-4">
          <Button className="w-full" disabled={pending || picked.length === 0} onClick={commit}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : picked.length > 0 ? (
              <Check className="size-4" />
            ) : null}
            {pending
              ? "Saving…"
              : picked.length === 0
                ? "Select brands to save"
                : `Save ${picked.length} brand${picked.length === 1 ? "" : "s"}`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
