"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BackLink, PageHeader } from "@/components/refine/ui";
import type { StaffRole } from "@/lib/refine/types";

export default function NewUserPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("BUYER");
  const [staffRoleId, setStaffRoleId] = useState<string>("none");
  const [saving, setSaving] = useState(false);
  const [temp, setTemp] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const rolesQuery = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async (): Promise<StaffRole[]> => {
      const res = await fetch("/api/v1/admin/roles");
      if (!res.ok) return [];
      return (await res.json()).data as StaffRole[];
    },
    retry: false,
  });
  const roles = rolesQuery.data ?? [];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/v1/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          ...(password ? { password } : {}),
          role,
          ...(staffRoleId !== "none" ? { staffRoleId } : {}),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Create failed.");
      setTemp(json.data.tempPassword as string);
      setCreatedId(json.data.id as string);
      toast.success(`Account created for ${email.trim()}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <BackLink href="/ys-admin/users" label="Users" />
      <PageHeader title="New user" description="Invite someone directly — temporary password shown once." />
      {temp ? (
        <Card className="space-y-2 border-emerald-500/40 p-5">
          <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Account created. Share this password once:</p>
          <p className="inline-flex items-center gap-2 rounded-lg bg-neutral-100 px-3 py-2 font-mono text-lg font-bold dark:bg-neutral-800">
            {temp}
            <Button size="sm" variant="ghost" className="h-6 px-1.5" aria-label="Copy password" onClick={() => { void navigator.clipboard?.writeText(temp); toast.success("Copied."); }}>
              <Copy className="size-3.5" />
            </Button>
          </p>
          <div>
            <Button size="sm" asChild><Link href={createdId ? `/ys-admin/users/show/${createdId}` : "/ys-admin/users"}>Open profile</Link></Button>
          </div>
        </Card>
      ) : null}
      <Card className="max-w-xl space-y-3 p-5">
        <form onSubmit={submit} className="grid gap-3">
          <div className="grid gap-1">
            <label className="text-sm font-medium">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} placeholder="Ada Lovelace" />
          </div>
          <div className="grid gap-1">
            <label className="text-sm font-medium">Email</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="ada@example.com" />
          </div>
          <div className="grid gap-1">
            <label className="text-sm font-medium">Password <span className="font-normal text-neutral-400">(optional — generated if blank)</span></label>
            <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min 8 chars" />
          </div>
          <div className="grid gap-1">
            <label className="text-sm font-medium">Account type</label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["BUYER", "SELLER", "ADMIN"].map((r) => (
                  <SelectItem key={r} value={r}>{r}{r === "ADMIN" ? " (superuser)" : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <label className="text-sm font-medium">Staff role <span className="font-normal text-neutral-400">(optional — console scopes)</span></label>
            <Select value={staffRoleId} onValueChange={setStaffRoleId}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name} ({r.scopes.length} scopes)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Button type="submit" disabled={saving} className="bg-ali-red text-white hover:bg-ali-red-dark">
              {saving ? <Loader2 className="size-4 animate-spin" /> : null} Create account
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
