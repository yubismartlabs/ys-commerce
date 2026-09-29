"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Heart toggle wired to the wishlist backend. */
export function WishlistHeart({ slug, wishlisted, queryKey }: { slug: string; wishlisted: boolean; queryKey: string[] }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [on, setOn] = useState(wishlisted);

  const toggle = async () => {
    setBusy(true);
    try {
      const res = await fetch(
        on ? `/api/v1/account/wishlist/${encodeURIComponent(slug)}` : "/api/v1/account/wishlist",
        on
          ? { method: "DELETE" }
          : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) }
      );
      if (res.status === 401) {
        toast.error("Sign in to use the wishlist.");
        return;
      }
      if (!res.ok) throw new Error("Wishlist update failed.");
      setOn(!on);
      toast.success(!on ? "Saved to watchlist." : "Removed from watchlist.");
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
    } catch {
      toast.error("Wishlist update failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      size="icon-lg"
      variant="outline"
      aria-label={on ? "Remove from watchlist" : "Save to watchlist"}
      aria-pressed={on}
      onClick={toggle}
      disabled={busy}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Heart className={cn("size-4", on && "fill-ali-red text-ali-red")} />}
    </Button>
  );
}
