import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ShoppingPreferences } from "@/components/account/shopping-preferences";

export const metadata = { title: "Preferences" };

export default function ShoppingPreferencesPage() {
  return (
    <div className="space-y-4">
      <Card className="relative overflow-hidden border-neutral-200 bg-neutral-900 p-6 text-white dark:border-neutral-800 dark:bg-neutral-800">
        {/* Decorative only, and behind the content — the copy has to stay
            legible, so this stays faint and never overlaps a glyph. */}
        <Sparkles
          aria-hidden
          className="pointer-events-none absolute -right-4 -top-6 size-32 text-white/5"
        />
        <div className="relative space-y-1.5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/50">
            Tailored to you
          </p>
          <h2 className="text-xl font-black tracking-tight">Tell us what you love, find what fits, faster.</h2>
          <p className="max-w-prose text-sm text-white/70">
            Save the sizes you wear and the brands you love. We&apos;ll flag the options that fit and
            surface their listings — no more guessing whether something runs small.
          </p>
        </div>
      </Card>

      <ShoppingPreferences />
    </div>
  );
}