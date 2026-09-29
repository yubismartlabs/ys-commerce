"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

/** Self-service profile: display name + password change. */
export function SecurityForm() {
  const { data: session, update } = useSession();
  const [name, setName] = useState<string | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const displayName = name ?? session?.user?.name ?? "";

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingName(true);
    try {
      const res = await fetch("/api/v1/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: displayName }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Save failed.");
      toast.success("Display name updated.");
      await update();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSavingName(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPw(true);
    try {
      const res = await fetch("/api/v1/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current, next }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Change failed.");
      toast.success("Password changed.");
      setCurrent("");
      setNext("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Change failed.");
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <div className="grid gap-6">
      <form onSubmit={saveName} className="grid gap-2">
        <p className="text-sm font-bold">Profile</p>
        <p className="text-xs text-neutral-500">{session?.user?.email}</p>
        <Input value={displayName} onChange={(e) => setName(e.target.value)} placeholder="Display name" maxLength={80} className="max-w-sm" />
        <div>
          <Button type="submit" size="sm" variant="outline" disabled={savingName}>
            {savingName ? <Loader2 className="size-4 animate-spin" /> : null} Save name
          </Button>
        </div>
      </form>
      <Separator />
      <form onSubmit={changePassword} className="grid gap-2">
        <p className="text-sm font-bold">Change password</p>
        <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="Current password" autoComplete="current-password" className="max-w-sm" />
        <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="New password (8+ chars)" autoComplete="new-password" className="max-w-sm" />
        <div>
          <Button type="submit" size="sm" variant="outline" disabled={savingPw || !current || next.length < 8}>
            {savingPw ? <Loader2 className="size-4 animate-spin" /> : null} Change password
          </Button>
        </div>
      </form>
    </div>
  );
}
