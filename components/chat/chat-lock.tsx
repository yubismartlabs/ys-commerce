"use client";

import { useEffect, useState } from "react";
import { Loader2, Lock, LockOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  createIdentity,
  hasIdentity,
  installIdentity,
  isUnlocked,
  unlockIdentity,
} from "@/lib/chat/e2ee";

type Phase = "loading" | "setup" | "unlock" | "restore" | "reset" | "ready";

/**
 * Chat lock gate: ensures this device holds the user's E2EE identity
 * (created, restored from backup, or unlocked) before rendering chat.
 * Private keys never leave the browser; the server keeps only the
 * passphrase-wrapped backup blob.
 */
export function ChatLock({ userId, children }: { userId: string; children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPhase("loading");
      if (isUnlocked(userId)) {
        if (!cancelled) setPhase("ready");
        return;
      }
      if (hasIdentity(userId)) {
        if (!cancelled) setPhase("unlock");
        return;
      }
      try {
        const res = await fetch("/api/v1/chat/keys");
        const json = await res.json().catch(() => null);
        const data = json?.data as { identityKey: string | null; hasBackup: boolean } | undefined;
        if (!cancelled) {
          if (data?.identityKey && data?.hasBackup) setPhase("restore");
          else if (data?.identityKey) setPhase("reset");
          else setPhase("setup");
        }
      } catch {
        if (!cancelled) setPhase("setup");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const publish = async (publicKey: string, backup: { wrappedPrivate: string; salt: string; iv: string }, rotate = false) => {
    const res = await fetch("/api/v1/chat/keys", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicKey, backup, ...(rotate ? { rotate: true } : {}) }),
    });
    if (!res.ok) throw new Error("Key publish failed.");
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setPass("");
      setPhase("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  };

  if (phase === "ready") return <>{children}</>;

  const copy: Record<Exclude<Phase, "loading" | "ready">, { title: string; hint: string; cta: string }> = {
    setup: {
      title: "Set up private chat",
      hint: "Create a chat passphrase. It encrypts your chat identity — not even ys-commerce can read your messages.",
      cta: "Create chat identity",
    },
    unlock: {
      title: "Unlock chat",
      hint: "Enter your chat passphrase to read and send messages on this device.",
      cta: "Unlock",
    },
    restore: {
      title: "Restore chat on this device",
      hint: "This device is new. Enter your existing chat passphrase to restore your identity.",
      cta: "Restore identity",
    },
    reset: {
      title: "Reset chat identity",
      hint: "Your old device key is gone and no backup exists. Creating a new identity makes old messages unreadable.",
      cta: "Create new identity",
    },
  };

  const submit = () => {
    if (phase === "setup" || phase === "reset") {
      void run(async () => {
        const { publicKey, backup } = await createIdentity(userId, pass);
        await publish(publicKey, backup, phase === "reset");
        toast.success("Private chat ready.");
      });
    } else if (phase === "unlock") {
      void run(async () => {
        await unlockIdentity(userId, pass);
      });
    } else if (phase === "restore") {
      void run(async () => {
        const res = await fetch("/api/v1/chat/keys?backup=1");
        const json = await res.json().catch(() => null);
        const backup = json?.data?.backup;
        if (!backup) throw new Error("No backup found.");
        const publicKey = await installIdentity(userId, backup, pass);
        await publish(publicKey, backup);
        toast.success("Identity restored.");
      });
    }
  };

  return (
    <Card className="mx-auto max-w-md space-y-3 p-6 text-center">
      {phase === "loading" ? (
        <p className="flex items-center justify-center gap-2 text-sm text-neutral-500">
          <Loader2 className="size-4 animate-spin" /> Checking chat identity…
        </p>
      ) : (
        <>
          <span className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900">
            {phase === "unlock" ? <LockOpen className="size-5" /> : <Lock className="size-5" />}
          </span>
          <h1 className="text-lg font-bold">{copy[phase].title}</h1>
          <p className="text-sm text-neutral-500">{copy[phase].hint}</p>
          {error ? <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</p> : null}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <Input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="Chat passphrase (4+ chars)"
              autoComplete="off"
              className="flex-1"
            />
            <Button type="submit" disabled={busy || pass.length < 4}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null} {copy[phase].cta}
            </Button>
          </form>
        </>
      )}
    </Card>
  );
}
