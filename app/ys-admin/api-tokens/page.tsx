"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, KeyRound, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { EmptyState, ErrorState, PageHeader, TableSkeleton } from "@/components/refine/ui";
import { timeAgo } from "@/lib/format";

type ApiToken = {
  id: string;
  name: string;
  scopes: string[];
  expiresAt: string | null;
  createdAt: string;
  user: { email: string };
};

async function loadTokens(): Promise<ApiToken[]> {
  const res = await fetch("/api/v1/admin/api-tokens");
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message ?? "Failed to load tokens.");
  return json.data as ApiToken[];
}

export default function ApiTokensPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin-api-tokens"], queryFn: loadTokens });
  const [name, setName] = useState("mobile-app");
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const mint = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFresh(null);
    setCopied(false);
    try {
      const res = await fetch("/api/v1/admin/api-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Mint failed.");
      setFresh(json.data.token as string);
      toast.success("Token minted — copy it now, it won't be shown again.");
      queryClient.invalidateQueries({ queryKey: ["admin-api-tokens"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Mint failed.");
    } finally {
      setBusy(false);
    }
  };

  const tokens = query.data ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="API tokens"
        description="Bearer tokens for the mobile app and scripts. Raw tokens are shown once."
        actions={
          <form className="flex gap-2" onSubmit={mint}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Token name" className="w-40" required maxLength={80} />
            <Button type="submit" disabled={busy} className="bg-ali-red text-white hover:bg-ali-red-dark">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Mint
            </Button>
          </form>
        }
      />

      {fresh ? (
        <Card className="space-y-2 border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
          <p className="flex items-center gap-1.5 text-sm font-bold text-amber-800 dark:text-amber-200">
            <KeyRound className="size-4" /> New token — copy it now
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all rounded-lg bg-white px-3 py-2 font-mono text-xs dark:bg-neutral-900">{fresh}</code>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(fresh);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>
        </Card>
      ) : null}

      <Card className="overflow-hidden p-0">
        {query.isLoading ? (
          <TableSkeleton rows={5} cols={4} />
        ) : query.isError ? (
          <ErrorState message="Failed to load tokens." />
        ) : tokens.length === 0 ? (
          <EmptyState icon={KeyRound} title="No tokens yet" hint="Mint one for the mobile app with the form above." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow><TableHead>Name</TableHead><TableHead>Owner</TableHead><TableHead>Scopes</TableHead><TableHead>Created</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {tokens.map((t) => (
                <TableRow key={t.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900">
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-neutral-500">{t.user.email}</TableCell>
                  <TableCell className="font-mono text-xs text-neutral-500">{t.scopes.join(", ")}</TableCell>
                  <TableCell className="whitespace-nowrap text-neutral-500">{timeAgo(t.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
