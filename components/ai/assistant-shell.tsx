"use client";

import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAssistant } from "@/lib/store/assistant";
import { usePublicSettings } from "@/lib/public-settings";
import { AssistantDrawer } from "@/components/ai/assistant-drawer";
import { cn } from "@/lib/utils";

/**
 * Left push-drawer shell (Amazon-style): on lg+ the aside sits in the flex
 * row and pushes the store right; on mobile it overlays fixed with a dim.
 */
export function AssistantShell({ children }: { children: React.ReactNode }) {
  const { open, close } = useAssistant();

  return (
    <div className="flex min-h-screen w-full items-stretch">
      {/* Mobile dim, only when open */}
      {open ? (
        <button
          aria-label="Close assistant"
          onClick={close}
          className="fixed inset-0 z-40 bg-black/20 lg:hidden"
        />
      ) : null}
      <aside
        aria-hidden={!open}
        aria-label="Shopping assistant"
        className={cn(
          "shrink-0 overflow-hidden bg-white transition-[width] duration-200 ease-in-out",
          // Mobile: fixed overlay. Desktop: in-flow push panel.
          "fixed inset-y-0 left-0 z-50 border-r lg:sticky lg:top-0 lg:z-auto lg:h-screen",
          open ? "w-[92vw] max-w-[400px] lg:w-[400px]" : "w-0 border-transparent"
        )}
      >
        <div className={cn("h-full w-[92vw] max-w-[400px] lg:w-[400px]", !open && "invisible")}>
          {open ? <AssistantDrawer /> : null}
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** Header icon trigger (shares the same store). */
export function AssistantHeaderButton({ className }: { className?: string }) {
  const { open, toggle } = useAssistant();
  const { aiName } = usePublicSettings();
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label={aiName} title={aiName} aria-expanded={open} className={className}>
      {open ? <X /> : <Sparkles />}
    </Button>
  );
}
