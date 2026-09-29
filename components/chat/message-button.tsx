"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Opens (or finds) a buyer↔seller conversation, then navigates to it.
 * Key exchange + encryption happen inside the thread — this only creates
 * the sealed envelope container.
 */
export function MessageButton({
  orderId,
  storeId,
  productId,
  subject,
  label,
  basePath,
  size = "sm",
  variant = "outline",
}: {
  orderId?: string;
  storeId?: string;
  productId?: string;
  subject?: string;
  label: string;
  basePath: "/account/messages" | "/selling/messages";
  size?: "sm" | "default";
  variant?: "outline" | "ghost" | "default";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const open = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/v1/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(orderId ? { orderId } : {}),
          ...(storeId ? { storeId } : {}),
          ...(productId ? { productId } : {}),
          ...(subject ? { subject } : {}),
        }),
      });
      const json = await res.json().catch(() => null);
      if (res.status === 401) {
        toast.error("Sign in to message.");
        return;
      }
      if (!res.ok) throw new Error(json?.error?.message ?? "Couldn't open chat.");
      router.push(`${basePath}/${json.data.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't open chat.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button size={size} variant={variant} onClick={open} disabled={busy} className="gap-1.5">
      {busy ? <Loader2 className="size-4 animate-spin" /> : <MessageCircle className="size-4" />}
      {label}
    </Button>
  );
}
