"use client";

import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SIZE_AUDIENCES } from "@/lib/shopping-preferences/size-taxonomy";

/**
 * Right-hand sheet for picking a size: audience tab, then garment group, then
 * the sizes that group comes in.
 *
 * No search box: the taxonomy is the navigation, and size labels are too short
 * and too ambiguous ("10" is a child and a shoe and a waist) for a global
 * search to rank sensibly. The audience tabs put the buyer in the right
 * universe first, where every chip they see is meaningful.
 */
export function SizePickerSheet({
  open,
  onOpenChange,
  saved,
  atLimit,
  onPick,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  saved: string[];
  atLimit: boolean;
  onPick: (size: string) => void;
}) {
  const [audience, setAudience] = useState(SIZE_AUDIENCES[0].key);
  const [groupKey, setGroupKey] = useState<string | null>(null);

  const current = SIZE_AUDIENCES.find((a) => a.key === audience) ?? SIZE_AUDIENCES[0];
  const group = current.groups.find((g) => g.key === groupKey) ?? null;

  // Reset to step one whenever the sheet is reopened, or the buyer lands on a
  // half-finished selection they no longer remember starting.
  const close = (next: boolean) => {
    if (!next) setGroupKey(null);
    onOpenChange(next);
  };

  const already = (size: string) => saved.some((s) => s.toLowerCase() === size.toLowerCase());

  const pick = (size: string) => {
    if (already(size)) {
      close(false);
      return;
    }
    onPick(size);
    close(false);
  };

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="space-y-1 border-b p-5 text-left">
          <SheetTitle>{group ? group.label : "Choose a size"}</SheetTitle>
          <SheetDescription>
            {group
              ? `${current.label} · ${group.label}`
              : "Pick who and what you're shopping for, so the sizes match."}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {group ? (
            <div className="space-y-3 p-4">
              <Button size="sm" variant="ghost" onClick={() => setGroupKey(null)}>
                <ChevronLeft className="size-4" /> All {current.label.toLowerCase()} sizes
              </Button>
              <div className="flex flex-wrap gap-2">
                {group.sizes.map((s) => (
                  <SizeChip key={s} size={s} onPick={pick} disabled={atLimit} done={already(s)} />
                ))}
              </div>
            </div>
          ) : (
            <Tabs value={audience} onValueChange={setAudience} className="gap-0">
              <div className="sticky top-0 z-10 border-b bg-popover px-4 pt-3">
                <TabsList variant="line" className="h-9 w-full justify-start gap-4 p-0">
                  {SIZE_AUDIENCES.map((a) => (
                    <TabsTrigger
                      key={a.key}
                      value={a.key}
                      className="h-auto flex-none px-0 pb-2 text-sm data-active:font-semibold"
                    >
                      {a.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              <div className="p-2">
                {current.groups.map((g) => (
                  <button
                    key={g.key}
                    type="button"
                    onClick={() => setGroupKey(g.key)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    <span className="font-medium">{g.label}</span>
                    <span className="text-xs text-neutral-400">{g.sizes.length} sizes</span>
                  </button>
                ))}
              </div>
            </Tabs>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SizeChip({
  size,
  onPick,
  disabled,
  done,
}: {
  size: string;
  onPick: (size: string) => void;
  disabled: boolean;
  done: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPick(size)}
      className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium transition hover:border-neutral-900 disabled:opacity-50 dark:border-neutral-700 dark:hover:border-white"
    >
      {done ? <span className="text-neutral-400 line-through">{size}</span> : size}
    </button>
  );
}